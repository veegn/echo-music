import QQMusic from "../qq-music-api/index.ts";
import axios from "axios";
import { logInfo, logWarn, logError, logDebug } from "../logger.js";

const TAG = "QQMusicService";

// ============================================================
// 错误类型
// ============================================================

export class CookieExpiredError extends Error {
    constructor(message = "登录已失效，请重新扫码登录") {
        super(message);
        this.name = "CookieExpiredError";
    }
}

/**
 * 判断 API 返回码是否为 Cookie 失效/未登录类错误
 * - 301:    未登录
 * - -1310:  登录超时
 * - 500003: 电台需要登录
 * - 500005: 电台 Cookie 过期
 */
export function isCookieError(code: number | string | undefined): boolean {
    return [301, -1310, 500003, 500005].includes(Number(code));
}

// ============================================================
// Cookie 解析 / 序列化
// ============================================================

/** Set-Cookie 属性键，解析时需要跳过 */
const COOKIE_ATTRIBUTE_KEYS = new Set([
    "path", "domain", "expires", "max-age",
    "samesite", "secure", "httponly", "priority", "partitioned",
]);

/** 应出现在序列化输出头部的 key 顺序（认证相关优先） */
const COOKIE_PREFERRED_ORDER = [
    "uin", "p_uin", "ptui_loginuin", "pt2gguin",
    "p_skey", "skey", "pt4_token",
    "qm_keyst", "qqmusic_key", "qqmusic_uin",
    "ptcz", "RK", "login_type", "tmeLoginType",
];

/**
 * 将 uin 字段规范化：去除 `o0` 前缀和引号
 * QQ 在不同字段中以多种格式存储同一个 uin
 */
function extractUinFromCookieMap(cookieMap: Record<string, string>): string {
    const raw =
        cookieMap.uin        ||
        cookieMap.ptui_loginuin ||
        cookieMap.pt2gguin   ||
        cookieMap.superuin   ||
        cookieMap.p_uin      ||
        cookieMap.qqmusic_uin ||
        "";
    return raw.replace(/^o0*/, "").replace(/"/g, "");
}

/**
 * 将 Cookie 字符串（支持多行/Set-Cookie 合并体）解析为键值 Map，
 * 并自动补全 uin / qqmusic_key / tmeLoginType 等衍生字段
 */
function parseCookieMap(cookie: string): Record<string, string> {
    const cookieMap: Record<string, string> = {};
    if (!cookie) return cookieMap;

    // 将换行符和 expires 前的逗号统一替换为分号
    const normalized = cookie
        .replace(/\r?\n/g, ";")
        .replace(/[;,]\s*(?=expires=)/gi, "; expires=");

    for (const raw of normalized.split(";")) {
        const part = raw.trim();
        if (!part || !part.includes("=")) continue;

        const eqIdx = part.indexOf("=");
        const key   = part.slice(0, eqIdx).trim();
        const value = part.slice(eqIdx + 1).trim();

        if (!key || COOKIE_ATTRIBUTE_KEYS.has(key.toLowerCase())) continue;
        if (!value || value === '""' || value === "deleted" || value === "null") continue;

        cookieMap[key] = value;
    }

    // 补全 uin（统一规范化）
    const uin = extractUinFromCookieMap(cookieMap);
    if (uin) cookieMap.uin = uin;

    // qqmusic_key ↔ qm_keyst 互相补全
    if (!cookieMap.qqmusic_key && cookieMap.qm_keyst)  cookieMap.qqmusic_key = cookieMap.qm_keyst;
    if (!cookieMap.qm_keyst   && cookieMap.qqmusic_key) cookieMap.qm_keyst   = cookieMap.qqmusic_key;

    // 默认 login_type / tmeLoginType
    if (!cookieMap.login_type)   cookieMap.login_type   = "1";
    if (!cookieMap.tmeLoginType) cookieMap.tmeLoginType = cookieMap.wxopenid ? "1" : "2";

    return cookieMap;
}

/** 将 Cookie Map 序列化为 Cookie header 字符串（认证字段优先排序） */
function serializeCookieMap(cookieMap: Record<string, string>): string {
    const orderMap = new Map(COOKIE_PREFERRED_ORDER.map((key, i) => [key, i]));

    return Object.entries(cookieMap)
        .filter(([, v]) => !!v)
        .sort(([a], [b]) => {
            const ai = orderMap.get(a) ?? 999;
            const bi = orderMap.get(b) ?? 999;
            return ai !== bi ? ai - bi : a.localeCompare(b);
        })
        .map(([k, v]) => `${k}=${v}`)
        .join("; ");
}

/** 将任意格式的 Cookie 字符串标准化 */
export function normalizeCookie(cookie: string): string {
    return serializeCookieMap(parseCookieMap(cookie));
}

/** 从 Cookie 字符串中提取规范化后的 uin（QQ 号） */
export function extractUin(cookie: string): string {
    return extractUinFromCookieMap(parseCookieMap(cookie));
}

// ============================================================
// QQ Music API 调用封装
// ============================================================

/** 调用 QQ Music 内部 API，统一处理 Cookie、日志和 Cookie 过期检测 */
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

    const t0 = Date.now();
    const result = await apiCall(path, { ...params, cookie: finalCookie });
    const ms = Date.now() - t0;

    const code    = result?.data?.code ?? result?.code;
    const subcode = result?.data?.subcode ?? result?.subcode;
    const cookiePreview = finalCookie
        ? `${finalCookie.slice(0, 10)}...${finalCookie.slice(-10)}`
        : "none";

    logInfo(TAG, `[API] ${path} | ${ms}ms | code=${code} | params=${JSON.stringify(params)} | cookie=${cookiePreview}`);
    logDebug(TAG, `QQMusic raw result: ${path}`, { result });

    return result;
}

// ============================================================
// 公开 API 函数
// ============================================================

/** 静态校验 Cookie 是否包含必要的认证字段（不发网络请求） */
export async function verifyCookie(cookie: string): Promise<{ success: boolean; message?: string }> {
    const normalized = normalizeCookie(cookie);
    const uin = extractUin(normalized);
    if (!uin) {
        logWarn(TAG, "Cookie validation failed: missing uin");
        return { success: false, message: "Cookie missing uin" };
    }

    const map = parseCookieMap(normalized);
    const AUTH_KEYS = ["qqmusic_key", "qm_keyst", "p_skey", "skey", "p_lskey", "lskey"];
    if (!AUTH_KEYS.some((k) => !!map[k])) {
        logWarn(TAG, "Cookie validation failed: missing auth key", { uin, keys: Object.keys(map) });
        return { success: false, message: "Cookie missing auth key" };
    }

    logInfo(TAG, "Cookie validation passed", { uin, keyCount: Object.keys(map).length });
    return { success: true };
}

export async function searchSongs(key: string, pageNo = 1, pageSize = 20): Promise<any> {
    return callQQMusic("/search", { key, pageNo, pageSize });
}

export async function getSongUrl(songmid: string, roomCookie: string | null): Promise<any> {
    try {
        const result = await callQQMusic("/song/url", { id: songmid }, roomCookie);
        logInfo(TAG, "getSongUrl response", {
            hasData:  !!result?.data,
            midMatch: !!(result?.data?.[songmid]),
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
        logWarn(TAG, "getLyric failed, returning empty", { songmid, msg: err.message });
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

export async function getRadioSongs(roomCookie: string | null): Promise<any> {
    if (!roomCookie) {
        throw new Error("请先绑定房主 QQ 音乐 Cookie 以使用私人电台");
    }

    const result = await callQQMusic("/radio", { id: "99" }, roomCookie);
    const tracks: any =
        Array.isArray(result) ? result :
        result?.data?.tracks   ||
        result?.tracks         ||
        result?.data?.songlist ||
        result?.data?.data?.tracks;

    if (!Array.isArray(tracks) || tracks.length === 0) {
        logWarn(TAG, "Private radio returned no tracks", { result });
        throw new Error("私人电台暂时没有返回可播放的曲目");
    }

    return {
        ...(typeof result === "object" ? result : {}),
        data: { ...(result?.data || {}), tracks },
    };
}

export async function getHotSearch(): Promise<any> {
    logInfo(TAG, "getHotSearch");
    return callQQMusic("/search/hot");
}

// ============================================================
// QR 码登录 — 常量与状态
// ============================================================

const QR_APPID        = "716027609";
const QR_DAID         = "383";
const QR_THIRD_AID    = "100497308";
const QR_LOGIN_JUMP_URL = "https://graph.qq.com/oauth2.0/login_jump";
const QR_TARGET_URL   = "https://y.qq.com/n/ryqq_v2/player_radio#id=99";
const QR_FEEDBACK_URL = "https://support.qq.com/products/77942?customInfo=.appid100497308";

/**
 * Chrome 145 Windows UA，仿浏览器请求以确保 ptlogin2 正常响应
 */
const QR_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";

/** 仿浏览器通用请求头（Accept / Accept-Language / sec-fetch-*） */
const BROWSER_HEADERS = {
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "sec-fetch-dest":  "document",
    "sec-fetch-mode":  "navigate",
} as const;

type QrContext = {
    loginSig:   string;
    xloginUrl:  string;
    cookieDict: Record<string, string>;
    createdAt:  number;
};

const qrContextMap    = new Map<string, QrContext>();
const QR_CONTEXT_TTL_MS = 10 * 60 * 1000; // 10 分钟

// ============================================================
// QR 码登录 — 辅助函数
// ============================================================

/** 清理超过 10 分钟的过期 QR Context */
function cleanupQrContexts() {
    const now = Date.now();
    for (const [sig, ctx] of qrContextMap.entries()) {
        if (now - ctx.createdAt > QR_CONTEXT_TTL_MS) qrContextMap.delete(sig);
    }
}

/**
 * hash33 算法：将 qrsig 转换为 ptqrtoken（腾讯 ptlogin2 约定）
 */
function hash33(qrsig: string): number {
    let h = 0;
    for (let i = 0; i < qrsig.length; i++) h += (h << 5) + qrsig.charCodeAt(i);
    return h & 2147483647;
}

/**
 * g_tk 算法：用于 QQ Connect 授权请求的防 CSRF token
 */
function getGToken(cookieDict: Record<string, string>): number {
    const src =
        cookieDict.qqmusic_key ||
        cookieDict.p_skey      ||
        cookieDict.skey        ||
        cookieDict.p_lskey     ||
        cookieDict.lskey       ||
        "";
    let h = 5381;
    for (let i = 0; i < src.length; i++) h += (h << 5) + src.charCodeAt(i);
    return h & 2147483647;
}

/** 生成 UUID v4 格式的 UI token */
function makeUiToken(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
        const r = Math.floor(Math.random() * 16);
        return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16).toUpperCase();
    });
}

/** 从 Set-Cookie 字符串数组中提取指定 key 的值 */
function getCookieValue(setCookies: string[] | undefined, key: string): string {
    if (!setCookies) return "";
    for (const str of setCookies) {
        const m = str.match(new RegExp(`${key}=([^;]+)`));
        if (m) return m[1];
    }
    return "";
}

/**
 * 将 HTTP Set-Cookie 响应头合并到 cookieDict，
 * 自动跳过空值、占位符（"deleted" / "null"）
 */
function mergeSetCookies(cookieDict: Record<string, string>, setCookies: string[] | undefined): void {
    if (!setCookies) return;
    for (const str of setCookies) {
        const first = str.split(";")[0];
        const idx   = first.indexOf("=");
        if (idx <= 0) continue;

        const key = first.slice(0, idx).trim();
        const val = first.slice(idx + 1).trim();
        if (!val || val === '""' || val === "deleted" || val === "null") continue;

        cookieDict[key] = val;
    }
}

/** 将 cookieDict 序列化为 Cookie 请求头 */
function buildCookieHeader(cookieDict: Record<string, string>): string {
    return serializeCookieMap(cookieDict);
}

/** 生成脱敏的 Cookie 摘要，用于日志记录 */
function summarizeCookie(cookie: string): Record<string, unknown> {
    const preview = (v: string | undefined, n = 6) => v ? `${v.slice(0, n)}...(${v.length})` : "";
    const vals    = parseCookieMap(cookie);
    return {
        keyCount:            Object.keys(vals).length,
        keys:                Object.keys(vals),
        uin:                 vals.uin || vals.p_uin || "",
        qqmusic_key:         preview(vals.qqmusic_key),
        qm_keyst:            preview(vals.qm_keyst),
        psrf_qqopenid:       preview(vals.psrf_qqopenid),
        psrf_qqaccess_token: preview(vals.psrf_qqaccess_token),
        ptcz:                preview(vals.ptcz),
        RK:                  preview(vals.RK),
    };
}

/** 构造 ptlogin2 xlogin 页面 URL */
function buildXloginUrl(redirectUrl: string): string {
    return (
        `https://xui.ptlogin2.qq.com/cgi-bin/xlogin` +
        `?appid=${QR_APPID}&daid=${QR_DAID}&style=33` +
        `&login_text=%E7%99%BB%E5%BD%95&hide_title_bar=1&hide_border=1&target=self` +
        `&s_url=${encodeURIComponent(redirectUrl)}&pt_3rd_aid=${QR_THIRD_AID}`
    );
}

/** 构造弹窗登录入口 URL（含反馈链接和主题参数） */
function buildPopupLoginUrl(): string {
    return (
        `${buildXloginUrl(QR_LOGIN_JUMP_URL)}` +
        `&pt_feedback_link=${encodeURIComponent(QR_FEEDBACK_URL)}&theme=2&verify_theme=`
    );
}

// ============================================================
// QR 码登录 — Cookie 交换
// ============================================================

/**
 * 调用 login_get_musickey 接口刷新 qqmusic_key 并补全 oauth 相关字段
 */
async function exchangeMusicCookies(cookieDict: Record<string, string>): Promise<void> {
    const musicuin = cookieDict.uin || cookieDict.p_uin || "";
    if (!musicuin) return;

    const params = new URLSearchParams({
        from:            "1",
        force_access:    "1",
        wxopenid:        cookieDict.wxopenid || musicuin,
        wxrefresh_token: cookieDict.wxrefresh_token || "",
        musickey:        cookieDict.qqmusic_key || cookieDict.qm_keyst || cookieDict.p_lskey || "",
        musicuin,
        get_access_token: "1",
        ct:              "1001",
        format:          "json",
        inCharset:       "utf-8",
        outCharset:      "utf-8",
    });

    const res = await axios.get(
        `https://c.y.qq.com/base/fcgi-bin/login_get_musickey.fcg?${params}`,
        {
            headers: { "User-Agent": QR_UA, "Referer": "https://y.qq.com/", "Cookie": buildCookieHeader(cookieDict) },
            validateStatus: () => true,
        },
    );

    mergeSetCookies(cookieDict, res.headers["set-cookie"]);
    if (res.status !== 200) {
        logWarn(TAG, "login_get_musickey rejected", { status: res.status });
        return;
    }

    const body = parseJsonSafe(res.data);
    logInfo(TAG, "login_get_musickey completed", {
        status:       res.status,
        code:         body?.code,
        hasSetCookie: !!(res.headers["set-cookie"]?.length),
    });

    // 将响应中的认证字段写入 cookieDict
    const fields: Record<string, string | undefined> = {
        qqmusic_key:         body?.key || body?.musickey || body?.qqmusic_key,
        qm_keyst:            body?.key || body?.musickey || body?.qm_keyst,
        psrf_qqaccess_token: body?.wxaccess_token || body?.qqaccess_token || body?.access_token,
        psrf_qqrefresh_token:body?.wxrefresh_token || body?.qqrefresh_token || body?.refresh_token,
        psrf_qqopenid:       body?.openid || body?.qqopenid,
        psrf_qqunionid:      body?.unionid || body?.qqunionid,
    };
    for (const [k, v] of Object.entries(fields)) {
        if (v) cookieDict[k] = v;
    }

    if (!cookieDict.login_type)   cookieDict.login_type   = "1";
    if (!cookieDict.tmeLoginType) cookieDict.tmeLoginType = cookieDict.wxopenid ? "1" : "2";
}

/**
 * 使用 QQ Connect code 换取 QQ Music 音乐 Cookie（musicu.fcg QQLogin）
 */
async function exchangeQQConnectMusicLogin(code: string, cookieDict: Record<string, string>): Promise<void> {
    const payload = {
        comm: { g_tk: getGToken(cookieDict), platform: "yqq", ct: 24, cv: 0 },
        req:  { module: "QQConnectLogin.LoginServer", method: "QQLogin", param: { code } },
    };

    const res = await axios.post("https://u.y.qq.com/cgi-bin/musicu.fcg", payload, {
        headers: {
            "User-Agent":   QR_UA,
            "Referer":      "https://y.qq.com/portal/wx_redirect.html",
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie":       buildCookieHeader(cookieDict),
        },
        transformRequest: [(d) => JSON.stringify(d)],
        validateStatus:   () => true,
    });

    mergeSetCookies(cookieDict, res.headers["set-cookie"]);
    const data = parseJsonSafe(res.data);
    logInfo(TAG, "QQConnectLogin.QQLogin completed", {
        status:  res.status,
        code:    data?.code,
        reqCode: data?.req?.code,
    });
}

/**
 * 使用当前 Cookie 向 graph.qq.com 发起 OAuth 授权，返回 redirect_uri（含 code）
 */
async function authorizeQQConnect(cookieDict: Record<string, string>): Promise<string> {
    const redirectUri = `https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=${encodeURIComponent(QR_TARGET_URL)}`;
    const form = new URLSearchParams({
        response_type: "code",
        client_id:     QR_THIRD_AID,
        redirect_uri:  redirectUri,
        scope:         "get_user_info,get_app_friends",
        state:         "state",
        from_ptlogin:  "1",
        src:           "1",
        update_auth:   "1",
        openapi:       "1010_1030",
        g_tk:          String(getGToken(cookieDict)),
        auth_time:     String(Date.now()),
        ui:            cookieDict.ui || makeUiToken(),
    });

    const res = await axios.post("https://graph.qq.com/oauth2.0/authorize", form.toString(), {
        headers: {
            "User-Agent":   QR_UA,
            "Referer":      "https://graph.qq.com/oauth2.0/show",
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie":       buildCookieHeader(cookieDict),
        },
        maxRedirects:   0,
        validateStatus: (s) => s >= 200 && s < 400,
    });

    mergeSetCookies(cookieDict, res.headers["set-cookie"]);
    const location = res.headers.location
        ? new URL(res.headers.location, "https://graph.qq.com/").toString()
        : "";
    logInfo(TAG, "graph.qq.com/authorize completed", { status: res.status, location });
    return location;
}

// ============================================================
// QR 码登录 — QIMEI h38 补全
// ============================================================

/**
 * 尝试补全 `_qimei_h38` 设备指纹。
 *
 * **背景**：`_qimei_h38` 由 QQ QIMEI JavaScript SDK 在浏览器端运行时生成，
 * 服务端 HTTP 请求无法直接获取。
 *
 * **策略**（按优先级）：
 * 1. 若 cookieDict 中已有该值（来自 Set-Cookie 响应头），直接返回
 * 2. 尝试向 QIMEI H5 SDK 端点注册，从响应中提取 h38
 * 3. 利用已观察到的结构规律从 `_qimei_uuid42` 推导兜底值：
 *    `h38 = uuid42[0:8] + uuid42[16:32] + "0200000521a30a"`
 */
async function resolveQimeiH38(cookieDict: Record<string, string>): Promise<void> {
    if (cookieDict._qimei_h38) return; // 已通过 Set-Cookie 获得

    const uuid42      = cookieDict._qimei_uuid42    || "";
    const fingerprint = cookieDict._qimei_fingerprint || "";
    const uin         = cookieDict.uin              || "";

    // --- 优先：QIMEI SDK H5 端点 ---
    try {
        const res = await axios.post(
            "https://qimei.qq.com/qimei/sdk/h5/multi",
            {
                appKey:       "0AND2ADpTU4JiH",
                appVersion:   "1.0.0",
                beaconId:     uuid42,
                platform:     "js",
                sdkVersion:   "v1.3.3-beta.1",
                h_sdkVersion: "h1.2.0.81_rc",
                userId:       uin,
                fp:           fingerprint,
                timestamp:    Date.now(),
            },
            {
                headers: {
                    "User-Agent":   QR_UA,
                    "Referer":      "https://y.qq.com/",
                    "Content-Type": "application/json",
                    "Cookie":       buildCookieHeader(cookieDict),
                },
                timeout:        5000,
                validateStatus: () => true,
            },
        );

        mergeSetCookies(cookieDict, res.headers["set-cookie"]);
        const body = parseJsonSafe(res.data);
        const h38  = body?.data?.q38 || body?.data?.h38 || body?.q38 || body?.h38 || "";
        if (h38 && /^[0-9a-f]{38}$/i.test(h38)) {
            cookieDict._qimei_h38 = h38;
            logInfo(TAG, "_qimei_h38 obtained from QIMEI SDK", { prefix: h38.slice(0, 8) });
            return;
        }
    } catch {
        // 端点不可达，继续兜底
    }

    // --- 兜底：从 uuid42 结构推导 ---
    // 规律（逆向观察）：h38[8:24] === uuid42[16:32]（设备唯一标识段）
    if (uuid42.length < 32) {
        logWarn(TAG, "Cannot derive _qimei_h38: uuid42 too short");
        return;
    }
    const prefix      = uuid42.slice(0, 8);   // uuid42 前段作为前缀替代
    const deviceShard = uuid42.slice(16, 32); // 设备唯一标识（服务端确定）
    const suffix      = "0200000521a30a";      // QQ Music H5 平台固定标识
    cookieDict._qimei_h38 = prefix + deviceShard + suffix;
    logInfo(TAG, "_qimei_h38 derived from uuid42", { prefix });
}

// ============================================================
// QR 码登录 — 公开接口
// ============================================================

/**
 * 获取登录二维码图片（Base64 PNG）和对应的 qrsig（用于后续状态轮询）
 */
export async function getLoginQrCode(): Promise<{ image: string; qrsig: string }> {
    try {
        cleanupQrContexts();

        const xloginUrl  = buildPopupLoginUrl();
        const xloginResp = await axios.get(xloginUrl, {
            headers:        { "User-Agent": QR_UA, "Referer": "https://graph.qq.com/" },
            validateStatus: (s) => s >= 200 && s < 500,
        });

        const cookieDict: Record<string, string> = {};
        mergeSetCookies(cookieDict, xloginResp.headers["set-cookie"]);
        const loginSig = getCookieValue(xloginResp.headers["set-cookie"], "pt_login_sig");

        const qrShowUrl = (
            `https://xui.ptlogin2.qq.com/ssl/ptqrshow` +
            `?appid=${QR_APPID}&e=2&l=M&s=3&d=72&v=4&t=${Math.random()}` +
            `&daid=${QR_DAID}&pt_3rd_aid=${QR_THIRD_AID}&u1=${encodeURIComponent(QR_LOGIN_JUMP_URL)}`
        );
        const qrResp = await axios.get(qrShowUrl, {
            responseType:   "arraybuffer",
            headers:        { "User-Agent": QR_UA, "Referer": xloginUrl, "Cookie": buildCookieHeader(cookieDict) },
            validateStatus: () => true,
        });

        if (qrResp.status !== 200) {
            throw new Error(`QR endpoint returned status ${qrResp.status}`);
        }

        const qrsig = getCookieValue(qrResp.headers["set-cookie"], "qrsig");
        if (!qrsig) throw new Error("qrsig is missing from QR response");

        mergeSetCookies(cookieDict, qrResp.headers["set-cookie"]);
        qrContextMap.set(qrsig, { loginSig, xloginUrl, cookieDict, createdAt: Date.now() });

        return {
            image: `data:image/png;base64,${Buffer.from(qrResp.data).toString("base64")}`,
            qrsig,
        };
    } catch (err) {
        logError(TAG, "getLoginQrCode failed", err);
        throw new Error("Failed to get login QR code");
    }
}

/**
 * 轮询 QR 码扫描状态，扫码成功后自动执行完整的 Cookie 交换流程。
 *
 * 状态码含义（腾讯 ptlogin2 约定）：
 * - 66: 等待扫描
 * - 67: 已扫描，等待确认
 * - 0:  登录成功
 * - 65: 二维码已过期
 */
export async function checkQrStatus(
    qrsig: string,
): Promise<{ status: number; message: string; cookie?: string }> {
    try {
        cleanupQrContexts();

        const ctx        = qrContextMap.get(qrsig);
        const xloginUrl  = ctx?.xloginUrl || buildPopupLoginUrl();
        const ptqrtoken  = hash33(qrsig);

        if (!ctx) {
            logWarn(TAG, "QR context not found", { qrsig: `${qrsig.slice(0, 10)}...` });
        }

        // --- 查询扫码状态 ---
        const query = new URLSearchParams({
            u1:         QR_LOGIN_JUMP_URL,
            ptqrtoken:  String(ptqrtoken),
            ptredirect: "0",
            h: "1", t: "1", g: "1",
            from_ui:    "1",
            ptlang:     "2052",
            action:     `0-0-${Date.now()}`,
            js_ver:     "26030415",
            js_type:    "1",
            pt_uistyle: "40",
            aid:        QR_APPID,
            daid:       QR_DAID,
            pt_3rd_aid: QR_THIRD_AID,
        });
        if (ctx?.loginSig) query.set("login_sig", ctx.loginSig);

        const requestCookies = { ...(ctx?.cookieDict ?? {}), qrsig };
        const loginResp = await axios.get(
            `https://xui.ptlogin2.qq.com/ssl/ptqrlogin?${query}`,
            {
                headers:        { "User-Agent": QR_UA, "Referer": xloginUrl, "Cookie": buildCookieHeader(requestCookies) },
                validateStatus: () => true,
            },
        );

        if (loginResp.status !== 200) {
            logWarn(TAG, "ptqrlogin rejected", { status: loginResp.status });
            return { status: 66, message: "QR status endpoint rejected, please refresh and retry" };
        }

        const parts = (String(loginResp.data).match(/'(.*?)'/g) ?? []).map((s) => s.replace(/'/g, ""));
        if (parts.length < 5) {
            return { status: 66, message: "Failed to parse QR status response" };
        }

        const statusCode = Number(parts[0]);
        const statusMsg  = parts[4];

        // 非成功状态：直接返回，65/67 同时清理 context
        if (statusCode !== 0) {
            if (statusCode === 65 || statusCode === 67) qrContextMap.delete(qrsig);
            return { status: statusCode, message: statusMsg };
        }

        logInfo(TAG, "QR scanned, starting cookie exchange", { jumpUrl: parts[2] });

        // --- Cookie 交换流程 ---
        const cookieDict: Record<string, string> = { ...requestCookies };
        mergeSetCookies(cookieDict, loginResp.headers["set-cookie"]);
        if (ctx?.loginSig) cookieDict.pt_login_sig = ctx.loginSig;

        // 辅助：跟随 HTTP 重定向并持续收集 Set-Cookie
        const redirectHistory: string[] = [];
        let   lastVisitedUrl            = "";

        const followRedirects = async (entryUrl: string, maxSteps = 8) => {
            let current = entryUrl;
            for (let i = 0; i < maxSteps; i++) {
                redirectHistory.push(current);
                const res = await axios.get(current, {
                    headers: {
                        "User-Agent": QR_UA,
                        "Referer":    "https://y.qq.com/",
                        ...BROWSER_HEADERS,
                        "Cookie":     buildCookieHeader(cookieDict),
                    },
                    maxRedirects:   0,
                    validateStatus: (s) => s >= 200 && s < 400,
                });
                mergeSetCookies(cookieDict, res.headers["set-cookie"]);
                lastVisitedUrl = current;

                if (res.status >= 300 && res.headers.location) {
                    current = new URL(res.headers.location, current).toString();
                    lastVisitedUrl = current;
                    continue;
                }
                break;
            }
        };

        // 辅助：从 URL 中提取 OAuth code 参数
        const extractCode = (url: string) => {
            try   { return new URL(url).searchParams.get("code") || ""; }
            catch { return ""; }
        };

        // 跟随 ptlogin 返回的 jumpUrl
        const jumpUrl = parts[2];
        if (jumpUrl) await followRedirects(jumpUrl);

        // 尝试从重定向历史中提取 QQ Connect code
        let qqLoginCode =
            redirectHistory.map(extractCode).find(Boolean) ||
            extractCode(lastVisitedUrl)                    ||
            extractCode(jumpUrl)                           ||
            "";

        // 若未拿到 code，尝试主动调用 graph.qq.com/authorize
        if (!qqLoginCode) {
            const authorizeLocation = await authorizeQQConnect(cookieDict);
            if (authorizeLocation) {
                redirectHistory.push(authorizeLocation);
                qqLoginCode = extractCode(authorizeLocation);
                await followRedirects(authorizeLocation);
            }
        }

        if (qqLoginCode) {
            logInfo(TAG, "Exchanging QQ Connect code for Music cookies", { code: `${qqLoginCode.slice(0, 10)}...` });
            await exchangeQQConnectMusicLogin(qqLoginCode, cookieDict);
        } else {
            logWarn(TAG, "QQ Connect code not found in redirect chain", {
                jumpUrl, lastVisitedUrl,
                history: redirectHistory.slice(0, 12),
            });
        }

        // 访问 y.qq.com 主页和目标页 + 刷新 Music Key
        logInfo(TAG, "Fetching final music cookies");
        await followRedirects("https://y.qq.com/");
        await followRedirects(QR_TARGET_URL);
        await exchangeMusicCookies(cookieDict);
        await followRedirects("https://y.qq.com/");
        await followRedirects(QR_TARGET_URL);

        // 补全 QIMEI h38
        await resolveQimeiH38(cookieDict);

        // 规范化 uin
        const uin = extractUin(buildCookieHeader(cookieDict));
        if (uin) {
            cookieDict.uin = uin;
        } else {
            logWarn(TAG, "uin extraction failed after redirect chain", { keys: Object.keys(cookieDict) });
        }

        // 清理临时字段
        delete cookieDict.qrsig;
        delete cookieDict.pt_login_sig;

        const finalCookie = serializeCookieMap(cookieDict);
        logInfo(TAG, "QR login succeeded", summarizeCookie(finalCookie));
        qrContextMap.delete(qrsig);

        return { status: 0, message: statusMsg, cookie: finalCookie };
    } catch (err) {
        logError(TAG, "checkQrStatus failed", err);
        throw new Error("Failed to check QR status");
    }
}

// ============================================================
// 内部工具
// ============================================================

/** 安全解析 JSON，失败返回 null（避免 try/catch 散落全文） */
function parseJsonSafe(data: unknown): any {
    if (typeof data !== "string") return data;
    try   { return JSON.parse(data); }
    catch { return null; }
}
