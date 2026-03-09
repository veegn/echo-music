// ============================
// QQ 音乐服务层
// ============================
// 封装 QQ 音乐 API 调用，统一 Cookie 处理逻辑

import QQMusic from "qq-music-api";
import { logInfo, logWarn, logError } from "../logger.js";

const TAG = "QQMusicService";

/**
 * 归一化 Cookie 字符串（去除多余空格，统一分隔符）
 * 之前此逻辑在 server.ts 中重复了 5 次
 */
export function normalizeCookie(cookie: string): string {
    return cookie.split(';').map(s => s.trim()).filter(Boolean).join('; ');
}

/**
 * 从 Cookie 中提取 QQ uin
 */
export function extractUin(cookie: string): string {
    const normalized = normalizeCookie(cookie);
    const uinMatch = normalized.match(/uin=([^;]+)/) || normalized.match(/ptui_loginuin=([^;]+)/);
    return uinMatch ? uinMatch[1].replace(/^o0*/, '') : '';
}

/**
 * 设置 QQ 音乐 Cookie 上下文
 * ⚠️ 注意：QQMusic.setCookie 是全局状态，并发请求可能存在竞态
 */
function applyRoomCookie(cookie: string | null): void {
    if (cookie) {
        QQMusic.setCookie(normalizeCookie(cookie));
    } else {
        QQMusic.setCookie("");
    }
}

/**
 * 验证 Cookie 格式是否包含有效 uin
 */
export async function verifyCookie(cookie: string): Promise<{ success: boolean; message?: string }> {
    const uin = extractUin(cookie);
    if (!uin) {
        logWarn(TAG, "Cookie 验证失败：未找到 uin");
        return { success: false, message: "Cookie 中未找到 uin" };
    }

    QQMusic.setCookie(normalizeCookie(cookie));
    logInfo(TAG, "Cookie 验证通过", { uin });
    return { success: true };
}

/**
 * 搜索歌曲
 */
export async function searchSongs(key: string, pageNo = 1, pageSize = 20): Promise<any> {
    logInfo(TAG, "搜索歌曲", { key, pageNo, pageSize });
    const result = await QQMusic.api("/search", { key, pageNo, pageSize });
    return result;
}

/**
 * 获取歌曲播放链接
 */
export async function getSongUrl(songmid: string, roomCookie: string | null): Promise<any> {
    logInfo(TAG, "获取歌曲播放链接", { songmid, hasCookie: !!roomCookie });
    applyRoomCookie(roomCookie);
    const result = await QQMusic.api("/song/url", { id: songmid });
    return result;
}

/**
 * 获取用户歌单列表
 */
export async function getUserSonglist(userId: string): Promise<any> {
    logInfo(TAG, "获取用户歌单", { userId });
    const result = await QQMusic.api("/user/songlist", { id: userId });
    return result;
}

/**
 * 获取个性推荐歌单
 */
export async function getRecommendPlaylist(roomCookie: string | null): Promise<any> {
    logInfo(TAG, "获取推荐歌单", { hasCookie: !!roomCookie });
    applyRoomCookie(roomCookie);
    const result = await QQMusic.api("/recommend/playlist/u");
    return result;
}

/**
 * 获取歌词
 */
export async function getLyric(songmid: string): Promise<any> {
    logInfo(TAG, "获取歌词", { songmid });
    const result = await QQMusic.api("/lyric", { songmid });
    return result;
}

/**
 * 获取歌单详情
 */
export async function getSonglistDetail(id: string, roomCookie: string | null): Promise<any> {
    logInfo(TAG, "获取歌单详情", { id, hasCookie: !!roomCookie });
    applyRoomCookie(roomCookie);
    const result = await QQMusic.api("/songlist", { id });
    return result;
}

/**
 * 获取用户详情
 */
export async function getUserDetail(userId: string): Promise<any> {
    logInfo(TAG, "获取用户详情", { userId });
    const result = await QQMusic.api("/user/detail", { id: userId });
    return result;
}
