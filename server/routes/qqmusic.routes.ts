// ============================
// QQ 音乐代理 API 路由
// ============================

import { Router } from "express";
import * as qqMusicService from "../services/qqmusic.service.js";
import * as roomService from "../services/room.service.js";
import { logError, logWarn } from "../logger.js";

const TAG = "QQMusicRoutes";
const router = Router();

/** POST /api/qqmusic/verify-cookie — 验证 Cookie */
router.post("/verify-cookie", async (req, res) => {
    try {
        const { cookie } = req.body;
        if (!cookie) {
            logWarn(TAG, "Cookie 为空");
            return res.json({ success: false, message: "Cookie 不能为空" });
        }
        const result = await qqMusicService.verifyCookie(cookie);
        res.json(result);
    } catch (err: any) {
        logError(TAG, "Cookie 验证异常", err);
        res.json({ success: false, message: err.message || "Cookie 验证失败" });
    }
});

/** GET /api/qqmusic/search — 搜索歌曲 */
router.get("/search", async (req, res) => {
    try {
        const { key, pageNo = 1, pageSize = 20 } = req.query;
        if (!key) {
            return res.status(400).json({ error: "搜索关键字不能为空" });
        }
        const result = await qqMusicService.searchSongs(
            key as string,
            Number(pageNo),
            Number(pageSize)
        );
        res.json(result);
    } catch (err: any) {
        logError(TAG, "搜索歌曲失败", err, { key: req.query.key });
        res.status(500).json({ error: err.message });
    }
});

/** GET /api/qqmusic/song/url — 获取歌曲播放链接 */
router.get("/song/url", async (req, res) => {
    try {
        const { id, roomId } = req.query;
        if (!id) {
            return res.status(400).json({ error: "歌曲 ID 不能为空" });
        }
        const room = roomId ? roomService.getRoom(roomId as string) : undefined;
        const cookie = room?.hostCookie ?? null;
        const result = await qqMusicService.getSongUrl(id as string, cookie);
        res.json(result);
    } catch (err: any) {
        logError(TAG, "获取歌曲 URL 失败", err, { songmid: req.query.id });
        res.status(500).json({ error: err.message });
    }
});

/** GET /api/qqmusic/user/songlist — 获取用户歌单列表 */
router.get("/user/songlist", async (req, res) => {
    try {
        const { id } = req.query;
        if (!id) {
            return res.status(400).json({ error: "用户 ID 不能为空" });
        }
        const result = await qqMusicService.getUserSonglist(id as string);
        res.json(result);
    } catch (err: any) {
        logError(TAG, "获取用户歌单失败", err, { userId: req.query.id });
        res.status(500).json({ error: err.message });
    }
});

/** GET /api/qqmusic/recommend/playlist/u — 获取推荐歌单 */
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
        logError(TAG, "获取推荐歌单失败", err);
        res.status(500).json({ error: err.message });
    }
});

/** GET /api/qqmusic/lyric — 获取歌词 */
router.get("/lyric", async (req, res) => {
    try {
        const { songmid } = req.query;
        if (!songmid) {
            return res.status(400).json({ error: "songmid 不能为空" });
        }
        const result = await qqMusicService.getLyric(songmid as string);
        res.json(result);
    } catch (err: any) {
        logError(TAG, "获取歌词失败", err, { songmid: req.query.songmid });
        res.status(500).json({ error: err.message });
    }
});

/** GET /api/qqmusic/songlist — 获取歌单详情 */
router.get("/songlist", async (req, res) => {
    try {
        const { id, roomId } = req.query;
        if (!id) {
            return res.status(400).json({ error: "歌单 ID 不能为空" });
        }
        const room = roomId ? roomService.getRoom(roomId as string) : undefined;
        if (roomId && !room) {
            return res.status(404).json({ error: "Room not found" });
        }
        const cookie = room?.hostCookie ?? null;
        const result = await qqMusicService.getSonglistDetail(id as string, cookie);
        res.json(result);
    } catch (err: any) {
        logError(TAG, "获取歌单详情失败", err, { songlistId: req.query.id });
        res.status(500).json({ error: err.message });
    }
});

export default router;
