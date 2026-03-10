import QQMusic from "qq-music-api";
import axios from "axios";
import { logInfo, logWarn, logError } from "../logger.js";

const TAG = "QQMusicService";

export function normalizeCookie(cookie: string): string {
    return cookie.split(";").map((s) => s.trim()).filter(Boolean).join("; ");
}

export function extractUin(cookie: string): string {
    const normalized = normalizeCookie(cookie);
    const uinMatch =
        normalized.match(/(?:^|;| )uin=([^;]+)/) ||
        normalized.match(/(?:^|;| )ptui_loginuin=([^;]+)/) ||
        normalized.match(/(?:^|;| )pt2gguin=([^;]+)/) ||
        normalized.match(/(?:^|;| )superuin=([^;]+)/) ||
        normalized.match(/(?:^|;| )p_uin=([^;]+)/);
    return uinMatch ? uinMatch[1].replace(/^o0*/, "") : "";
}

function applyRoomCookie(cookie: string | null): void {
    if (cookie) {
        QQMusic.setCookie(normalizeCookie(cookie));
    } else {
        QQMusic.setCookie("");
    }
}

// qq-music-api uses global cookie state internally; serialize calls to avoid cross-room cookie leakage.
let qqMusicCallQueue: Promise<unknown> = Promise.resolve();

function withCookieContext<T>(cookie: string | null, task: () => Promise<T>): Promise<T> {
    const run = async () => {
        applyRoomCookie(cookie);
        try {
            return await task();
        } finally {
            QQMusic.setCookie("");
        }
    };

    const next = qqMusicCallQueue.then(run, run);
    qqMusicCallQueue = next.then(() => undefined, () => undefined);
    return next;
}

function callQQMusic(path: string, params?: Record<string, unknown>, cookie: string | null = null): Promise<any> {
    return withCookieContext(cookie, () => QQMusic.api(path, params ?? {}));
}

export async function verifyCookie(cookie: string): Promise<{ success: boolean; message?: string }> {
    const uin = extractUin(cookie);
    if (!uin) {
        logWarn(TAG, "Cookie validation failed: missing uin");
        return { success: false, message: "Cookie missing uin" };
    }

    logInfo(TAG, "Cookie validation passed", { uin });
    return { success: true };
}

export async function searchSongs(key: string, pageNo = 1, pageSize = 20): Promise<any> {
    logInfo(TAG, "Search songs", { key, pageNo, pageSize });
    return callQQMusic("/search", { key, pageNo, pageSize });
}

export async function getSongUrl(songmid: string, roomCookie: string | null): Promise<any> {
    logInfo(TAG, "Get song url", { songmid, hasCookie: !!roomCookie });
    try {
        const result = await callQQMusic("/song/url", { id: songmid }, roomCookie);
        logInfo(TAG, "Song url response preview", {
            hasData: !!result?.data,
            dataType: typeof result?.data,
            midMatch: !!(result?.data && result.data[songmid]),
        });
        return result;
    } catch (err: any) {
        logError(TAG, "QQMusic.api /song/url failed", err, { songmid });
        throw err;
    }
}

export async function getUserSonglist(userId: string, roomCookie: string | null = null): Promise<any> {
    logInfo(TAG, "Get user songlist", { userId, hasCookie: !!roomCookie });
    return callQQMusic("/user/songlist", { id: userId }, roomCookie);
}

export async function getRecommendPlaylist(roomCookie: string | null): Promise<any> {
    logInfo(TAG, "Get recommend playlist", { hasCookie: !!roomCookie });
    return callQQMusic("/recommend/playlist/u", undefined, roomCookie);
}

export async function getLyric(songmid: string): Promise<any> {
    logInfo(TAG, "Get lyric", { songmid });
    try {
        return await callQQMusic("/lyric", { songmid });
    } catch (err: any) {
        logWarn(TAG, "Get lyric failed (fallback empty)", { songmid, msg: err.message });
        return { lyric: "", trans: "" };
    }
}

export async function getSonglistDetail(id: string, roomCookie: string | null): Promise<any> {
    logInfo(TAG, "Get songlist detail", { id, hasCookie: !!roomCookie });
    return callQQMusic("/songlist", { id }, roomCookie);
}

export async function getUserDetail(userId: string): Promise<any> {
    logInfo(TAG, "Get user detail", { userId });
    return callQQMusic("/user/detail", { id: userId });
}

export async function getRadioCategories(): Promise<any> {
    logInfo(TAG, "Get radio categories");
    return callQQMusic("/radio/category");
}

export async function getRadioSongs(id: string, roomCookie: string | null): Promise<any> {
    logInfo(TAG, "Get radio songs", { id, hasCookie: !!roomCookie });
    return callQQMusic("/radio", { id }, roomCookie);
}

export async function getHotSearch(): Promise<any> {
    logInfo(TAG, "Get hot search");
    return callQQMusic("/search/hot");
}

const QR_APPID = "716027609";
const QR_DAID = "383";
const QR_THIRD_AID = "100497308";
const QR_LOGIN_JUMP_URL = "https://graph.qq.com/oauth2.0/login_jump";
const QR_TARGET_URL = "https://y.qq.com/n/ryqq_v2/player_radio#id=99";
const QR_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";
const QR_FEEDBACK_URL = "https://support.qq.com/products/77942?customInfo=.appid100497308";

type QrContext = {
    loginSig: string;
    xloginUrl: string;
    cookieDict: Record<string, string>;
    createdAt: number;
};

const qrContextMap = new Map<string, QrContext>();
const QR_CONTEXT_TTL_MS = 10 * 60 * 1000;

function cleanupQrContexts() {
    const now = Date.now();
    for (const [qrsig, ctx] of qrContextMap.entries()) {
        if (now - ctx.createdAt > QR_CONTEXT_TTL_MS) {
            qrContextMap.delete(qrsig);
        }
    }
}

function hash33(qrsig: string): number {
    let hash = 0;
    for (let i = 0; i < qrsig.length; i++) {
        hash += (hash << 5) + qrsig.charCodeAt(i);
    }
    return hash & 2147483647;
}

function getGToken(cookieDict: Record<string, string>): number {
    const source =
        cookieDict.qqmusic_key ||
        cookieDict.p_skey ||
        cookieDict.skey ||
        cookieDict.p_lskey ||
        cookieDict.lskey ||
        "";

    let hash = 5381;
    for (let i = 0; i < source.length; i++) {
        hash += (hash << 5) + source.charCodeAt(i);
    }
    return hash & 2147483647;
}

function makeUiToken(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
        const rand = Math.floor(Math.random() * 16);
        const val = ch === "x" ? rand : (rand & 0x3) | 0x8;
        return val.toString(16).toUpperCase();
    });
}

function getCookieValue(setCookies: string[] | undefined, key: string): string {
    if (!setCookies) return "";
    for (const cookieStr of setCookies) {
        const match = cookieStr.match(new RegExp(`${key}=([^;]+)`));
        if (match) return match[1];
    }
    return "";
}

function mergeSetCookies(cookieDict: Record<string, string>, setCookies: string[] | undefined) {
    if (!setCookies) return;
    for (const cookieStr of setCookies) {
        const firstPart = cookieStr.split(";")[0];
        const idx = firstPart.indexOf("=");
        if (idx <= 0) continue;

        const key = firstPart.slice(0, idx).trim();
        const val = firstPart.slice(idx + 1).trim();
        if (!val || val === "\"\"" || val === "deleted" || val === "null") continue;

        cookieDict[key] = val;
    }
}

function buildCookieHeader(cookieDict: Record<string, string>): string {
    return Object.entries(cookieDict).map(([k, v]) => `${k}=${v}`).join("; ");
}

function summarizeCookie(cookie: string): Record<string, unknown> {
    const normalized = normalizeCookie(cookie);
    const keys = normalized
        .split("; ")
        .map((entry) => entry.split("=")[0])
        .filter(Boolean);

    const preview = (value: string | undefined, keep = 6) =>
        value ? `${value.slice(0, keep)}...(${value.length})` : "";

    const values = Object.fromEntries(
        normalized
            .split("; ")
            .map((entry) => {
                const idx = entry.indexOf("=");
                if (idx <= 0) return null;
                return [entry.slice(0, idx), entry.slice(idx + 1)];
            })
            .filter(Boolean) as Array<[string, string]>
    );

    return {
        keyCount: keys.length,
        keys,
        uin: values.uin || values.p_uin || "",
        qqmusic_key: preview(values.qqmusic_key),
        qm_keyst: preview(values.qm_keyst),
        psrf_qqopenid: preview(values.psrf_qqopenid),
        psrf_qqaccess_token: preview(values.psrf_qqaccess_token),
        psrf_qqrefresh_token: preview(values.psrf_qqrefresh_token),
        ptcz: preview(values.ptcz),
        RK: preview(values.RK),
    };
}

async function exchangeMusicCookies(cookieDict: Record<string, string>): Promise<void> {
    const musicuin = cookieDict.uin || cookieDict.p_uin || "";
    if (!musicuin) {
        return;
    }

    const params = new URLSearchParams({
        from: "1",
        force_access: "1",
        wxopenid: cookieDict.wxopenid || musicuin,
        wxrefresh_token: cookieDict.wxrefresh_token || "",
        musickey: cookieDict.qqmusic_key || cookieDict.qm_keyst || cookieDict.p_lskey || "",
        musicuin,
        get_access_token: "1",
        ct: "1001",
        format: "json",
        inCharset: "utf-8",
        outCharset: "utf-8",
    });

    const res = await axios.get(`https://c.y.qq.com/base/fcgi-bin/login_get_musickey.fcg?${params.toString()}`, {
        headers: {
            "User-Agent": QR_UA,
            "Referer": "https://y.qq.com/",
            "Cookie": buildCookieHeader(cookieDict),
        },
        validateStatus: () => true,
    });

    mergeSetCookies(cookieDict, res.headers["set-cookie"]);

    if (res.status !== 200) {
        logWarn(TAG, "login_get_musickey rejected", { status: res.status });
        return;
    }

    const body = typeof res.data === "string" ? (() => {
        try {
            return JSON.parse(res.data);
        } catch {
            return null;
        }
    })() : res.data;

    logInfo(TAG, "login_get_musickey completed", {
        status: res.status,
        code: body?.code,
        hasData: !!body?.data,
        bodyKeys: body && typeof body === "object" ? Object.keys(body).slice(0, 12) : [],
        dataKeys: body?.data && typeof body.data === "object" ? Object.keys(body.data).slice(0, 12) : [],
        hasSetCookie: Array.isArray(res.headers["set-cookie"]) && res.headers["set-cookie"].length > 0,
    });

    const directCookieMap: Record<string, string | undefined> = {
        qqmusic_key: body?.key || body?.musickey || body?.qqmusic_key,
        qm_keyst: body?.key || body?.musickey || body?.qm_keyst,
        psrf_qqaccess_token: body?.wxaccess_token || body?.qqaccess_token || body?.access_token,
        psrf_qqrefresh_token: body?.wxrefresh_token || body?.qqrefresh_token || body?.refresh_token,
        psrf_qqopenid: body?.openid || body?.qqopenid,
        psrf_qqunionid: body?.unionid || body?.qqunionid,
    };

    for (const [key, value] of Object.entries(directCookieMap)) {
        if (value) {
            cookieDict[key] = value;
        }
    }

    if (!cookieDict.login_type) {
        cookieDict.login_type = "1";
    }
    if (!cookieDict.tmeLoginType) {
        cookieDict.tmeLoginType = cookieDict.wxopenid ? "1" : "2";
    }
}

async function exchangeQQConnectMusicLogin(code: string, cookieDict: Record<string, string>): Promise<void> {
    const body = {
        comm: {
            g_tk: getGToken(cookieDict),
            platform: "yqq",
            ct: 24,
            cv: 0,
        },
        req: {
            module: "QQConnectLogin.LoginServer",
            method: "QQLogin",
            param: {
                code,
            },
        },
    };

    const res = await axios.post("https://u.y.qq.com/cgi-bin/musicu.fcg", body, {
        headers: {
            "User-Agent": QR_UA,
            "Referer": "https://y.qq.com/portal/wx_redirect.html",
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": buildCookieHeader(cookieDict),
        },
        transformRequest: [(data) => JSON.stringify(data)],
        validateStatus: () => true,
    });

    mergeSetCookies(cookieDict, res.headers["set-cookie"]);

    const data = typeof res.data === "string" ? (() => {
        try {
            return JSON.parse(res.data);
        } catch {
            return null;
        }
    })() : res.data;

    logInfo(TAG, "QQConnectLogin.LoginServer.QQLogin completed", {
        status: res.status,
        code: data?.code,
        reqCode: data?.req?.code,
        hasSetCookie: Array.isArray(res.headers["set-cookie"]) && res.headers["set-cookie"].length > 0,
        dataKeys: data?.req?.data && typeof data.req.data === "object" ? Object.keys(data.req.data).slice(0, 12) : [],
    });
}

async function authorizeQQConnect(cookieDict: Record<string, string>): Promise<string> {
    const form = new URLSearchParams({
        response_type: "code",
        client_id: QR_THIRD_AID,
        redirect_uri: "https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=https%3A%2F%2Fy.qq.com%2Fn%2Fryqq_v2%2Fplayer_radio%23id%3D99",
        scope: "get_user_info,get_app_friends",
        state: "state",
        from_ptlogin: "1",
        src: "1",
        update_auth: "1",
        openapi: "1010_1030",
        g_tk: String(getGToken(cookieDict)),
        auth_time: String(Date.now()),
        ui: cookieDict.ui || makeUiToken(),
    });

    const res = await axios.post("https://graph.qq.com/oauth2.0/authorize", form.toString(), {
        headers: {
            "User-Agent": QR_UA,
            "Referer": "https://graph.qq.com/oauth2.0/show",
            "Content-Type": "application/x-www-form-urlencoded",
            "Cookie": buildCookieHeader(cookieDict),
        },
        maxRedirects: 0,
        validateStatus: (s) => s >= 200 && s < 400,
    });

    mergeSetCookies(cookieDict, res.headers["set-cookie"]);

    const location = res.headers.location ? new URL(res.headers.location, "https://graph.qq.com/").toString() : "";
    logInfo(TAG, "graph authorize completed", {
        status: res.status,
        hasLocation: !!location,
        location,
        hasSetCookie: Array.isArray(res.headers["set-cookie"]) && res.headers["set-cookie"].length > 0,
    });

    return location;
}

function buildXloginUrl(redirectUrl: string): string {
    return `https://xui.ptlogin2.qq.com/cgi-bin/xlogin?appid=${QR_APPID}&daid=${QR_DAID}&style=33&login_text=%E7%99%BB%E5%BD%95&hide_title_bar=1&hide_border=1&target=self&s_url=${encodeURIComponent(redirectUrl)}&pt_3rd_aid=${QR_THIRD_AID}`;
}

function buildPopupLoginUrl(): string {
    return `${buildXloginUrl(QR_LOGIN_JUMP_URL)}&pt_feedback_link=${encodeURIComponent(QR_FEEDBACK_URL)}&theme=2&verify_theme=`;
}

export async function getLoginQrCode(): Promise<{ image: string; qrsig: string }> {
    try {
        cleanupQrContexts();

        const xloginUrl = buildPopupLoginUrl();
        const xloginResp = await axios.get(xloginUrl, {
            headers: {
                "User-Agent": QR_UA,
                "Referer": "https://graph.qq.com/",
            },
            validateStatus: (s) => s >= 200 && s < 500,
        });

        const cookieDict: Record<string, string> = {};
        mergeSetCookies(cookieDict, xloginResp.headers["set-cookie"]);
        const loginSig = getCookieValue(xloginResp.headers["set-cookie"], "pt_login_sig");

        const qrShowUrl = `https://xui.ptlogin2.qq.com/ssl/ptqrshow?appid=${QR_APPID}&e=2&l=M&s=3&d=72&v=4&t=${Math.random()}&daid=${QR_DAID}&pt_3rd_aid=${QR_THIRD_AID}&u1=${encodeURIComponent(QR_LOGIN_JUMP_URL)}`;
        const qrResp = await axios.get(qrShowUrl, {
            responseType: "arraybuffer",
            headers: {
                "User-Agent": QR_UA,
                "Referer": xloginUrl,
                "Cookie": buildCookieHeader(cookieDict),
            },
            validateStatus: () => true,
        });

        if (qrResp.status !== 200) {
            logError(TAG, "Get QR image failed", undefined, { status: qrResp.status });
            throw new Error("QR endpoint returned abnormal status");
        }

        const qrsig = getCookieValue(qrResp.headers["set-cookie"], "qrsig");
        if (!qrsig) {
            throw new Error("qrsig is missing");
        }

        mergeSetCookies(cookieDict, qrResp.headers["set-cookie"]);
        qrContextMap.set(qrsig, { loginSig, xloginUrl, cookieDict, createdAt: Date.now() });

        const image = `data:image/png;base64,${Buffer.from(qrResp.data).toString("base64")}`;
        return { image, qrsig };
    } catch (err) {
        logError(TAG, "Get login QR code failed", err);
        throw new Error("Failed to get login QR code");
    }
}

export async function checkQrStatus(qrsig: string): Promise<{ status: number; message: string; cookie?: string }> {
    try {
        cleanupQrContexts();

        const ctx = qrContextMap.get(qrsig);
        const ptqrtoken = hash33(qrsig);
        const action = `0-0-${Date.now()}`;
        const xloginUrl = ctx?.xloginUrl || buildPopupLoginUrl();

        const query = new URLSearchParams({
            u1: QR_LOGIN_JUMP_URL,
            ptqrtoken: String(ptqrtoken),
            ptredirect: "0",
            h: "1",
            t: "1",
            g: "1",
            from_ui: "1",
            ptlang: "2052",
            action,
            js_ver: "26030415",
            js_type: "1",
            pt_uistyle: "40",
            aid: QR_APPID,
            daid: QR_DAID,
            pt_3rd_aid: QR_THIRD_AID,
        });
        if (ctx?.loginSig) {
            query.set("login_sig", ctx.loginSig);
        }

        const requestCookies = { ...(ctx?.cookieDict ?? {}), qrsig };
        const loginResp = await axios.get(`https://xui.ptlogin2.qq.com/ssl/ptqrlogin?${query.toString()}`, {
            headers: {
                "User-Agent": QR_UA,
                "Referer": xloginUrl,
                "Cookie": buildCookieHeader(requestCookies),
            },
            validateStatus: () => true,
        });

        if (loginResp.status !== 200) {
            logWarn(TAG, "QR status request rejected", { status: loginResp.status });
            return { status: 66, message: "QR status endpoint rejected, please refresh and retry" };
        }

        const parts = String(loginResp.data).match(/'(.*?)'/g)?.map((s: string) => s.replace(/'/g, "")) || [];
        if (parts.length < 5) {
            return { status: 66, message: "Failed to parse QR status, please retry" };
        }

        const statusCode = Number(parts[0]);
        const statusMsg = parts[4];

        if (statusCode !== 0) {
            if (statusCode === 65 || statusCode === 67) {
                qrContextMap.delete(qrsig);
            }
            return { status: statusCode, message: statusMsg };
        }

        const cookieDict: Record<string, string> = { ...requestCookies };
        mergeSetCookies(cookieDict, loginResp.headers["set-cookie"]);
        if (ctx?.loginSig) {
            cookieDict.pt_login_sig = ctx.loginSig;
        }

        let lastVisitedUrl = "";
        const redirectHistory: string[] = [];
        const followRedirects = async (entryUrl: string, maxSteps = 8) => {
            let current = entryUrl;
            for (let i = 0; i < maxSteps; i++) {
                redirectHistory.push(current);
                const res = await axios.get(current, {
                    headers: {
                        "User-Agent": QR_UA,
                        "Referer": "https://y.qq.com/",
                        "Cookie": buildCookieHeader(cookieDict),
                    },
                    maxRedirects: 0,
                    validateStatus: (s) => s >= 200 && s < 400,
                });
                mergeSetCookies(cookieDict, res.headers["set-cookie"]);
                lastVisitedUrl = current;

                if (res.status >= 300 && res.status < 400 && res.headers.location) {
                    current = new URL(res.headers.location, current).toString();
                    lastVisitedUrl = current;
                    continue;
                }
                break;
            }
        };

        const jumpUrl = parts[2];
        if (jumpUrl) {
            await followRedirects(jumpUrl);
        }

        const extractCodeFromUrl = (url: string): string => {
            try {
                return new URL(url).searchParams.get("code") || "";
            } catch {
                return "";
            }
        };

        let qqLoginCode =
            redirectHistory.map(extractCodeFromUrl).find(Boolean) ||
            (lastVisitedUrl ? extractCodeFromUrl(lastVisitedUrl) : "") ||
            (jumpUrl ? extractCodeFromUrl(jumpUrl) : "") ||
            "";
        if (!qqLoginCode) {
            const authorizeLocation = await authorizeQQConnect(cookieDict);
            if (authorizeLocation) {
                redirectHistory.push(authorizeLocation);
                qqLoginCode = extractCodeFromUrl(authorizeLocation);
                if (authorizeLocation) {
                    await followRedirects(authorizeLocation);
                }
            }
        }
        if (qqLoginCode) {
            await exchangeQQConnectMusicLogin(qqLoginCode, cookieDict);
        } else {
            logWarn(TAG, "QQ login code missing after redirect chain", {
                jumpUrl: jumpUrl || "",
                lastVisitedUrl,
                redirectHistory: redirectHistory.slice(0, 12),
            });
        }

        await followRedirects("https://y.qq.com/");
        await followRedirects("https://y.qq.com/n/ryqq_v2/player_radio#id=99");
        await exchangeMusicCookies(cookieDict);
        await followRedirects("https://y.qq.com/");
        await followRedirects("https://y.qq.com/n/ryqq_v2/player_radio#id=99");

        const normalizedUin = extractUin(buildCookieHeader(cookieDict));
        if (normalizedUin) {
            cookieDict.uin = normalizedUin;
        }

        delete cookieDict.qrsig;
        delete cookieDict.pt_login_sig;

        const preferredOrder = [
            "uin",
            "p_uin",
            "ptui_loginuin",
            "pt2gguin",
            "p_skey",
            "skey",
            "pt4_token",
            "qm_keyst",
            "qqmusic_key",
            "qqmusic_uin",
            "ptcz",
            "RK",
        ];
        const orderMap = new Map(preferredOrder.map((k, i) => [k, i]));

        const finalCookie = Object.entries(cookieDict)
            .filter(([, v]) => !!v)
            .sort(([a], [b]) => {
                const ai = orderMap.has(a) ? orderMap.get(a)! : 999;
                const bi = orderMap.has(b) ? orderMap.get(b)! : 999;
                if (ai !== bi) return ai - bi;
                return a.localeCompare(b);
            })
            .map(([k, v]) => `${k}=${v}`)
            .join("; ");

        logInfo(TAG, "QR login succeeded", summarizeCookie(finalCookie));
        qrContextMap.delete(qrsig);

        return { status: 0, message: statusMsg, cookie: finalCookie };
    } catch (err) {
        logError(TAG, "Check QR status failed", err);
        throw new Error("Failed to check QR status");
    }
}


