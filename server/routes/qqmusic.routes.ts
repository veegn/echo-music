import { Router } from "express";
import * as qqMusicService from "../services/qqmusic.service.js";
import * as roomService from "../services/room.service.js";
import { logError, logInfo, logWarn } from "../logger.js";

const TAG = "QQMusicRoutes";
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
        logError(TAG, "Cookie verification error", err);
        res.json({ success: false, message: err.message || "Cookie verification failed" });
    }
});

router.get("/search", async (req, res) => {
    try {
        const { key, pageNo = 1, pageSize = 20 } = req.query;
        if (!key) {
            return res.status(400).json({ error: "Search keyword is required" });
        }
        const result = await qqMusicService.searchSongs(key as string, Number(pageNo), Number(pageSize));
        res.json(result);
    } catch (err: any) {
        logError(TAG, "Search songs failed", err, { key: req.query.key });
        res.status(500).json({ error: err.message });
    }
});

router.get("/song/url", async (req, res) => {
    try {
        const { id, roomId } = req.query;
        if (!id) {
            return res.status(400).json({ error: "Song ID is required" });
        }
        const room = roomId ? roomService.getRoom(roomId as string) : undefined;
        const cookie = room?.hostCookie ?? null;
        const result = await qqMusicService.getSongUrl(id as string, cookie);
        res.json(result);
    } catch (err: any) {
        logError(TAG, "Get song url failed", err, { songmid: req.query.id });
        res.status(500).json({ error: err.message });
    }
});

router.get("/user/songlist", async (req, res) => {
    try {
        const { id, roomId } = req.query;
        if (!id) {
            return res.status(400).json({ error: "User ID is required" });
        }
        const room = roomId ? roomService.getRoom(roomId as string) : undefined;
        if (roomId && !room) {
            return res.status(404).json({ error: "Room not found" });
        }
        const cookie = room?.hostCookie ?? null;
        const result = await qqMusicService.getUserSonglist(id as string, cookie);
        res.json(result);
    } catch (err: any) {
        logError(TAG, "Get user songlist failed", err, { userId: req.query.id });
        res.status(500).json({ error: err.message });
    }
});

router.get("/recommend/playlist/u", async (req, res) => {
    try {
        const { roomId } = req.query;
        const room = roomId ? roomService.getRoom(roomId as string) : undefined;
        if (roomId && !room) {
            return res.status(404).json({ error: "Room not found" });
        }
        const cookie = room?.hostCookie ?? null;
        const result = await qqMusicService.getRecommendPlaylist(cookie);
        res.json(result);
    } catch (err: any) {
        logError(TAG, "Get recommended playlist failed", err);
        res.status(500).json({ error: err.message });
    }
});

router.get("/lyric", async (req, res) => {
    try {
        const { songmid } = req.query;
        if (!songmid) {
            return res.status(400).json({ error: "songmid is required" });
        }
        const result = await qqMusicService.getLyric(songmid as string);
        res.json(result);
    } catch (err: any) {
        logError(TAG, "Get lyric failed", err, { songmid: req.query.songmid });
        res.status(500).json({ error: err.message });
    }
});

router.get("/songlist", async (req, res) => {
    try {
        const { id, roomId } = req.query;
        if (!id) {
            return res.status(400).json({ error: "Songlist ID is required" });
        }
        const room = roomId ? roomService.getRoom(roomId as string) : undefined;
        if (roomId && !room) {
            return res.status(404).json({ error: "Room not found" });
        }
        const cookie = room?.hostCookie ?? null;
        const result = await qqMusicService.getSonglistDetail(id as string, cookie);
        res.json(result);
    } catch (err: any) {
        logError(TAG, "Get songlist detail failed", err, { songlistId: req.query.id });
        res.status(500).json({ error: err.message });
    }
});

router.get("/radio/categories", async (_req, res) => {
    try {
        const result = await qqMusicService.getRadioCategories();
        res.json(result);
    } catch (err: any) {
        logError(TAG, "Get radio categories failed", err);
        res.status(500).json({ error: err.message });
    }
});

router.get("/radio/songs", async (req, res) => {
    try {
        const { id, roomId } = req.query;
        if (!id) return res.status(400).json({ error: "Radio ID is required" });
        const room = roomId ? roomService.getRoom(roomId as string) : undefined;
        const cookie = room?.hostCookie ?? null;
        const result = await qqMusicService.getRadioSongs(id as string, cookie);
        res.json(result);
    } catch (err: any) {
        logError(TAG, "Get radio songs failed", err, { radioId: req.query.id });
        res.status(500).json({ error: err.message });
    }
});

router.get("/hot", async (_req, res) => {
    try {
        const result = await qqMusicService.getHotSearch();
        res.json(result);
    } catch (err: any) {
        logError(TAG, "Get hot search failed", err);
        res.status(500).json({ error: err.message });
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
        const { qrsig } = req.query;
        if (!qrsig) {
            return res.status(400).json({ success: false, message: "Missing qrsig" });
        }
        const result = await qqMusicService.checkQrStatus(qrsig as string);
        if (result.status === 0) {
            logInfo(TAG, "QR status finished with cookie", {
                hasCookie: !!result.cookie,
                cookieLength: result.cookie?.length || 0,
            });
        }
        res.json({ success: true, ...result });
    } catch (err: any) {
        logError(TAG, "Check QR status failed", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

export default router;
