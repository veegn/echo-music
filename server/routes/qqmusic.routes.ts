import { Response, Router } from "express";
import { Server } from "socket.io";
import * as qqMusicService from "../services/qqmusic.service.js";
import * as roomService from "../services/room.service.js";
import { logError, logInfo, logWarn } from "../logger.js";
import type { RequestHandler, Request, NextFunction } from "express";

const TAG = "QQMusicRoutes";

function extractPlaylistList(payload: any): any[] {
    const candidates = [
        payload?.list,
        payload?.data?.list,
        payload?.data?.response?.data?.playlists,
        payload?.data?.data?.playlists,
        payload?.response?.data?.playlists,
    ];

    return candidates.find(Array.isArray) || [];
}

function extractRadioStations(payload: any): any[] {
    const groupList =
        payload?.data?.data?.data?.groupList ||
        payload?.data?.data?.groupList ||
        payload?.data?.groupList ||
        payload?.groupList ||
        [];

    if (!Array.isArray(groupList)) return [];

    return groupList.flatMap((group: any) =>
        Array.isArray(group?.radioList)
            ? group.radioList.map((station: any) => ({
                ...station,
                groupName: group.name || "",
            }))
            : []
    );
}

function extractRadioTracks(payload: any): any[] {
    const candidates = [
        payload?.tracks,
        payload?.data?.tracks,
        payload?.data?.trackList,
        payload?.data?.songlist,
        payload?.data?.new_song?.data?.songlist,
        payload?.data?.data?.tracks,
        payload?.data?.data?.trackList,
        payload?.data?.data?.songlist,
    ];

    return candidates.find(Array.isArray) || [];
}

function badRequest(res: Response, error: string) {
    return res.status(400).json({ error });
}

function notFound(res: Response, error: string) {
    return res.status(404).json({ error });
}

function handleError(res: Response, err: any) {
    logError(TAG, "API Error", err);
    res.status(500).json({ error: err.message });
}

// Wrapper to auto-catch async errors and avoid repetative try-catch blocks
function asyncHandler(fn: RequestHandler): RequestHandler {
    return (req: Request, res: Response, next: NextFunction) => {
        Promise.resolve(fn(req, res, next)).catch(err => {
            handleError(res, err);
        });
    };
}

export default function createQQMusicRouter(io: Server): Router {
    const router = Router();

    router.post("/verify-cookie", asyncHandler(async (req, res) => {
        const { cookie } = req.body;
        if (!cookie) {
            logWarn(TAG, "Cookie is empty");
            return res.json({ success: false, message: "Cookie is required" });
        }
        res.json(await qqMusicService.verifyCookie(cookie));
    }));

    router.post("/room-cookie", asyncHandler(async (req, res) => {
        const { roomId, cookie } = req.body;
        if (!roomId) return badRequest(res, "roomId is required");

        const room = roomService.getRoom(String(roomId));
        if (!room) return notFound(res, "Room not found");

        const normalizedCookie = String(cookie || "").trim();
        if (normalizedCookie) {
            const result = await qqMusicService.verifyCookie(normalizedCookie);
            if (!result.success) {
                return res.status(400).json({ success: false, message: result.message || "Invalid cookie" });
            }
        }

        roomService.setRoomCookie(room, normalizedCookie);
        return res.json({
            success: true,
            room: roomService.getSafeRoomState(room),
        });
    }));

    router.get("/search", asyncHandler(async (req, res) => {
        const { key, pageNo = 1, pageSize = 20 } = req.query;
        if (!key) return badRequest(res, "Search keyword is required");
        res.json(await qqMusicService.searchSongs(key as string, Number(pageNo), Number(pageSize)));
    }));

    router.get("/song/url", asyncHandler(async (req, res) => {
        const { id, roomId } = req.query;
        if (!id) return badRequest(res, "Song ID is required");
        const room = roomId ? roomService.getRoom(roomId as string) : undefined;
        const cookie = room?.hostCookie ?? null;
        res.json(await qqMusicService.getSongUrl(id as string, cookie));
    }));

    router.get("/user/songlist", asyncHandler(async (req, res) => {
        const { id, roomId } = req.query;
        if (!id) return badRequest(res, "User ID is required");
        const room = roomId ? roomService.getRoom(roomId as string) : undefined;
        if (roomId && !room) return notFound(res, "Room not found");
        const cookie = room?.hostCookie ?? null;
        if (roomId && !cookie) return badRequest(res, "Host QQMusic cookie is required for user playlists");

        const result = await qqMusicService.getUserSonglist(id as string, cookie);
        res.json({ ...result, list: extractPlaylistList(result) });
    }));

    router.get("/recommend/playlist/u", asyncHandler(async (req, res) => {
        const { roomId } = req.query;
        const room = roomId ? roomService.getRoom(roomId as string) : undefined;
        if (roomId && !room) return notFound(res, "Room not found");
        res.json(await qqMusicService.getRecommendPlaylist(room?.hostCookie ?? null));
    }));

    router.get("/lyric", asyncHandler(async (req, res) => {
        const { songmid } = req.query;
        if (!songmid) return badRequest(res, "songmid is required");
        res.json(await qqMusicService.getLyric(songmid as string));
    }));

    router.get("/songlist", asyncHandler(async (req, res) => {
        const { id, roomId } = req.query;
        if (!id) return badRequest(res, "Songlist ID is required");
        const room = roomId ? roomService.getRoom(roomId as string) : undefined;
        if (roomId && !room) return notFound(res, "Room not found");
        res.json(await qqMusicService.getSonglistDetail(id as string, room?.hostCookie ?? null));
    }));

    router.get("/radio/categories", asyncHandler(async (_req, res) => {
        res.json(await qqMusicService.getRadioCategories());
    }));

    router.get("/radio/songs", asyncHandler(async (req, res) => {
        const { roomId, id = "99" } = req.query;
        const room = roomId ? roomService.getRoom(roomId as string) : undefined;
        if (roomId && !room) return notFound(res, "Room not found");
        const cookie = room?.hostCookie ?? null;
        if (!cookie) return badRequest(res, "Host QQMusic cookie is required for radio songs");

        const result = await qqMusicService.getRadioSongs(cookie, String(id));
        const tracks = Array.isArray(result) ? result : extractRadioTracks(result);
        const stations = Array.isArray(result?.stations) ? result.stations : extractRadioStations(result);

        res.json({
            tracks,
            stations,
            data: Array.isArray(result) ? { tracks, stations } : result,
        });
    }));

    router.get("/hot", asyncHandler(async (_req, res) => {
        res.json(await qqMusicService.getHotSearch());
    }));

    router.get("/qrcode", asyncHandler(async (_req, res) => {
        res.json({ success: true, ...await qqMusicService.getLoginQrCode() });
    }));

    router.get("/qrcode/status", asyncHandler(async (req, res) => {
        const { qrsig, roomId } = req.query;
        if (!qrsig) return badRequest(res, "Missing qrsig");

        const result = await qqMusicService.checkQrStatus(qrsig as string);
        let roomState;

        if (result.status === 0 && roomId && result.cookie) {
            const room = roomService.getRoom(roomId as string);
            if (room) {
                roomService.setRoomCookie(room, result.cookie);
                roomState = roomService.getSafeRoomState(room);
                io.to(roomId as string).emit("room_state", roomState);
                logInfo(TAG, "Auto-updated room cookie after QR login", { roomId });
            }
        }
        res.json({ success: true, ...result, room: roomState });
    }));

    return router;
}
