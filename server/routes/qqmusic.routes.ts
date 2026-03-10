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

/** GET /api/qqmusic/radio/categories — 获取所有电台 */
router.get("/radio/categories", async (req, res) => {
    try {
        const result = await qqMusicService.getRadioCategories();
        res.json(result);
    } catch (err: any) {
        logError(TAG, "获取电台分类失败", err);
        res.status(500).json({ error: err.message });
    }
});

/** GET /api/qqmusic/radio/songs — 获取某个电台的歌曲列表 */
router.get("/radio/songs", async (req, res) => {
    try {
        const { id, roomId } = req.query;
        if (!id) return res.status(400).json({ error: "电台 ID 不能为空" });
        const room = roomId ? roomService.getRoom(roomId as string) : undefined;
        const cookie = room?.hostCookie ?? null;
        const result = await qqMusicService.getRadioSongs(id as string, cookie);
        res.json(result);
    } catch (err: any) {
        logError(TAG, "获取电台歌曲失败", err, { radioId: req.query.id });
        res.status(500).json({ error: err.message });
    }
});

/** GET /api/qqmusic/search/hot — 获取搜索热词 (可选) */
router.get("/hot", async (req, res) => {
    try {
        const result = await qqMusicService.getHotSearch();
        res.json(result);
    } catch (err: any) {
        logError(TAG, "获取热词失败", err);
        res.status(500).json({ error: err.message });
    }
});

export default router;

/**
 * ============================
 * 扫码登录专用接口
 * ============================
 */

/** GET /api/qqmusic/qrcode — 获取登录二维码 */
router.get("/qrcode", async (req, res) => {
    try {
        const result = await qqMusicService.getLoginQrCode();
        res.json({ success: true, ...result });
    } catch (err: any) {
        logError(TAG, "请求二维码接口失败", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

/** GET /api/qqmusic/qrcode/status — 轮询二维码状态 */
router.get("/qrcode/status", async (req, res) => {
    try {
        const { qrsig } = req.query;
        if (!qrsig) {
            return res.status(400).json({ success: false, message: "缺少 qrsig 参数" });
        }
        const result = await qqMusicService.checkQrStatus(qrsig as string);
        res.json({ success: true, ...result });
    } catch (err: any) {
        logError(TAG, "检查二维码状态失败", err);
        res.status(500).json({ success: false, message: err.message });
    }
});
