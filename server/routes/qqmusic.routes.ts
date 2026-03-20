import { Response, Router } from "express";
import { Server } from "socket.io";
import * as qqMusicService from "../services/qqmusic.service.js";
import * as roomService from "../services/room.service.js";
import { logError, logInfo, logWarn } from "../logger.js";

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

export default function createQQMusicRouter(io: Server): Router {
    const router = Router();

    router.post("/verify-cookie", async (req, res) => {
        try {
            const { cookie } = req.body;
            if (!cookie) {
                logWarn(TAG, "Cookie is empty");
                return res.json({ success: false, message: "Cookie is required" });
            }
            const result = await qqMusicService.verifyCookie(cookie);
            res.json(result);
        } catch (err: any) {
            handleError(res, err);
        }
    });

    router.post("/room-cookie", async (req, res) => {
        try {
            const { roomId, cookie } = req.body;
            if (!roomId) {
                return res.status(400).json({ success: false, message: "roomId is required" });
            }

            const room = roomService.getRoom(String(roomId));
            if (!room) {
                return res.status(404).json({ success: false, message: "Room not found" });
            }

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
        } catch (err: any) {
            handleError(res, err);
        }
    });

    router.get("/search", async (req, res) => {
        try {
            const { key, pageNo = 1, pageSize = 20 } = req.query;
            if (!key) {
                return badRequest(res, "Search keyword is required");
            }
            const result = await qqMusicService.searchSongs(key as string, Number(pageNo), Number(pageSize));
            res.json(result);
        } catch (err: any) {
            handleError(res, err);
        }
    });

    router.get("/song/url", async (req, res) => {
        try {
            const { id, roomId } = req.query;
            if (!id) {
                return badRequest(res, "Song ID is required");
            }
            const room = roomId ? roomService.getRoom(roomId as string) : undefined;
            const cookie = room?.hostCookie ?? null;
            const result = await qqMusicService.getSongUrl(id as string, cookie);
            res.json(result);
        } catch (err: any) {
            handleError(res, err);
        }
    });

    router.get("/user/songlist", async (req, res) => {
        try {
            const { id, roomId } = req.query;
            if (!id) {
                return badRequest(res, "User ID is required");
            }
            const room = roomId ? roomService.getRoom(roomId as string) : undefined;
            if (roomId && !room) {
                return notFound(res, "Room not found");
            }
            const cookie = room?.hostCookie ?? null;
            if (roomId && !cookie) {
                return badRequest(res, "Host QQMusic cookie is required for user playlists");
            }
            const result = await qqMusicService.getUserSonglist(id as string, cookie);
            const list = extractPlaylistList(result);
            res.json({ ...result, list });
        } catch (err: any) {
            handleError(res, err);
        }
    });

    router.get("/recommend/playlist/u", async (req, res) => {
        try {
            const { roomId } = req.query;
            const room = roomId ? roomService.getRoom(roomId as string) : undefined;
            if (roomId && !room) {
                return notFound(res, "Room not found");
            }
            const cookie = room?.hostCookie ?? null;
            const result = await qqMusicService.getRecommendPlaylist(cookie);
            res.json(result);
        } catch (err: any) {
            handleError(res, err);
        }
    });

    router.get("/lyric", async (req, res) => {
        try {
            const { songmid } = req.query;
            if (!songmid) {
                return badRequest(res, "songmid is required");
            }
            const result = await qqMusicService.getLyric(songmid as string);
            res.json(result);
        } catch (err: any) {
            handleError(res, err);
        }
    });

    router.get("/songlist", async (req, res) => {
        try {
            const { id, roomId } = req.query;
            if (!id) {
                return badRequest(res, "Songlist ID is required");
            }
            const room = roomId ? roomService.getRoom(roomId as string) : undefined;
            if (roomId && !room) {
                return notFound(res, "Room not found");
            }
            const cookie = room?.hostCookie ?? null;
            const result = await qqMusicService.getSonglistDetail(id as string, cookie);
            res.json(result);
        } catch (err: any) {
            handleError(res, err);
        }
    });

    router.get("/radio/categories", async (_req, res) => {
        try {
            const result = await qqMusicService.getRadioCategories();
            res.json(result);
        } catch (err: any) {
            handleError(res, err);
        }
    });

    router.get("/radio/songs", async (req, res) => {
        try {
            const { roomId, id = "99" } = req.query;
            const room = roomId ? roomService.getRoom(roomId as string) : undefined;
            if (roomId && !room) {
                return notFound(res, "Room not found");
            }
            const cookie = room?.hostCookie ?? null;
            if (!cookie) {
                return badRequest(res, "Host QQMusic cookie is required for radio songs");
            }

            const result = await qqMusicService.getRadioSongs(cookie, String(id));
            const tracks = Array.isArray(result) ? result : extractRadioTracks(result);
            const stations = Array.isArray(result?.stations)
                ? result.stations
                : extractRadioStations(result);

            res.json({
                tracks,
                stations,
                data: Array.isArray(result) ? { tracks, stations } : result,
            });
        } catch (err: any) {
            handleError(res, err);
        }
    });

    router.get("/hot", async (_req, res) => {
        try {
            const result = await qqMusicService.getHotSearch();
            res.json(result);
        } catch (err: any) {
            handleError(res, err);
        }
    });

    router.get("/qrcode", async (_req, res) => {
        try {
            const result = await qqMusicService.getLoginQrCode();
            res.json({ success: true, ...result });
        } catch (err: any) {
            logError(TAG, "Get QR code failed", err);
            res.status(500).json({ success: false, message: err.message });
        }
    });

    router.get("/qrcode/status", async (req, res) => {
        try {
            const { qrsig, roomId } = req.query;
            if (!qrsig) {
                return res.status(400).json({ success: false, message: "Missing qrsig" });
            }

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
        } catch (err: any) {
            logError(TAG, "Check QR status failed", err);
            res.status(500).json({ success: false, message: err.message });
        }
    });

    return router;
}
