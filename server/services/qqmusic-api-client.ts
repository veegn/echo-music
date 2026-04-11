import { logDebug, logError, logInfo, logWarn } from "../logger.js";
import { normalizeCookie } from "./qqmusic-cookie.js";
import QQMusic from "qq-music-api";

const TAG = "QQMusicApiClient";

function summarizeQQMusicError(result: any) {
    const error = result?.error ?? result?.data?.error ?? result?.body?.error;
    if (!error) {
        return null;
    }

    const responseData = error?.response?.data;
    return {
        name: error?.name,
        message: error?.message,
        code: error?.code,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        url: error?.config?.url,
        method: error?.config?.method,
        params: error?.config?.params,
        data: typeof responseData === "string"
            ? responseData.slice(0, 300)
            : responseData ?? null,
    };
}

async function callQQMusic(
    path: string,
    params?: Record<string, unknown>,
    cookie: string | null = null,
): Promise<any> {
    const finalCookie = cookie ? normalizeCookie(cookie) : undefined;

    const apiCall = typeof QQMusic.api === "function"
        ? QQMusic.api
        : (QQMusic as any).default?.api;
    if (typeof apiCall !== "function") {
        throw new Error(`QQMusic.api is not a function. Got: ${JSON.stringify(QQMusic)}`);
    }

    const startedAt = Date.now();
    try {
        const result = await apiCall(path, { ...params, cookie: finalCookie });
        const durationMs = Date.now() - startedAt;

        const code = result?.data?.code ?? result?.code;
        const cookiePreview = finalCookie
            ? `${finalCookie.slice(0, 10)}...${finalCookie.slice(-10)}`
            : "none";
        const errorSummary = summarizeQQMusicError(result);

        if (errorSummary) {
            logError(TAG, `[API] ${path} upstream error after ${durationMs}ms`, undefined, {
                params,
                cookie: cookiePreview,
                upstream: errorSummary,
            });
        } else {
            logInfo(TAG, `[API] ${path} | ${durationMs}ms | code=${code}`, {
                params,
                cookie: cookiePreview,
            });
        }
        logDebug(TAG, `QQMusic raw result: ${path}`, { result });

        return result;
    } catch (err: any) {
        const durationMs = Date.now() - startedAt;
        const cookiePreview = finalCookie
            ? `${finalCookie.slice(0, 10)}...${finalCookie.slice(-10)}`
            : "none";

        logError(TAG, `[API] ${path} threw after ${durationMs}ms`, err, {
            params,
            cookie: cookiePreview,
            status: err?.response?.status,
            statusText: err?.response?.statusText,
            upstreamData: typeof err?.response?.data === "string"
                ? err.response.data.slice(0, 300)
                : err?.response?.data ?? null,
        });
        throw err;
    }
}

export async function searchSongs(key: string, pageNo = 1, pageSize = 20): Promise<any> {
    return callQQMusic("/search", { key, pageNo, pageSize });
}

export async function getSongUrl(songmid: string, roomCookie: string | null): Promise<any> {
    try {
        const result = await callQQMusic("/song/url", { id: songmid }, roomCookie);
        const resolvedQuality =
            result?.data?.quality
            || result?.data?.resolvedQuality
            || result?.quality
            || result?.resolvedQuality
            || null;
        logInfo(TAG, "getSongUrl response", {
            hasData: !!result?.data,
            midMatch: !!result?.data?.[songmid],
            resolvedQuality,
        });
        return result;
    } catch (err: any) {
        logError(TAG, "getSongUrl failed", err, { songmid });
        throw err;
    }
}

export async function getUserSonglist(userId: string, roomCookie: string | null = null): Promise<any> {
    return callQQMusic("/user/songlist", { id: userId }, roomCookie);
}

export async function getRecommendPlaylist(roomCookie: string | null): Promise<any> {
    return callQQMusic("/recommend/playlist/u", undefined, roomCookie);
}

export async function getNewSongs(): Promise<any> {
    return callQQMusic("/songs/new", { areaId: 5, limit: 20 });
}

export async function getLyric(songmid: string): Promise<any> {
    try {
        return await callQQMusic("/lyric", { songmid });
    } catch (err: any) {
        logWarn(TAG, "getLyric failed, returning empty", { songmid, message: err.message });
        return { lyric: "", trans: "" };
    }
}

export async function getSonglistDetail(id: string, roomCookie: string | null): Promise<any> {
    return callQQMusic("/songlist", { id }, roomCookie);
}

export async function getUserDetail(userId: string): Promise<any> {
    return callQQMusic("/user/detail", { id: userId });
}

export async function getRadioCategories(): Promise<any> {
    return callQQMusic("/radio/category");
}

export async function getRadioSongs(roomCookie: string | null, radioId = "99"): Promise<any> {
    if (!roomCookie) {
        throw new Error("请先绑定房主 QQ 音乐 Cookie 后再使用私人电台");
    }

    const result = await callQQMusic("/radio", { id: radioId }, roomCookie);
    const tracks = result?.data?.songlist?.data?.tracks;
    if (!Array.isArray(tracks) || tracks.length === 0) {
        throw new Error("私人电台暂时没有返回可播放的曲目");
    }

    return tracks;
}

export async function getHotSearch(): Promise<any> {
    logInfo(TAG, "getHotSearch");
    return callQQMusic("/search/hot");
}
