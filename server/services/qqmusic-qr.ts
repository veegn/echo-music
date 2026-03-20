import axios from "axios";
import { logError, logInfo, logWarn } from "../logger.js";
import {
    extractUin,
    serializeCookieMap,
    summarizeCookie,
} from "./qqmusic-cookie.js";

const TAG = "QQMusicQr";

const QR_APPID = "716027609";
const QR_DAID = "383";
const QR_THIRD_AID = "100497308";
const QR_LOGIN_JUMP_URL = "https://graph.qq.com/oauth2.0/login_jump";
const QR_TARGET_URL = "https://y.qq.com/n/ryqq_v2/player_radio#id=99";
const QR_FEEDBACK_URL = "https://support.qq.com/products/77942?customInfo=.appid100497308";
const QR_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";

const BROWSER_HEADERS = {
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
} as const;

type QrContext = {
    loginSig: string;
    xloginUrl: string;
    cookieDict: Record<string, string>;
    createdAt: number;
};

const qrContextMap = new Map<string, QrContext>();
const QR_CONTEXT_TTL_MS = 10 * 60 * 1000;

function cleanupQrContexts(): void {
    const now = Date.now();
    for (const [sig, ctx] of qrContextMap.entries()) {
        if (now - ctx.createdAt > QR_CONTEXT_TTL_MS) {
            qrContextMap.delete(sig);
        }
    }
}

function hash33(qrsig: string): number {
    let h = 0;
    for (let i = 0; i < qrsig.length; i++) {
        h += (h << 5) + qrsig.charCodeAt(i);
    }
    return h & 2147483647;
}

function getGToken(cookieDict: Record<string, string>): number {
    const src =
        cookieDict.qqmusic_key ||
        cookieDict.p_skey ||
        cookieDict.skey ||
        cookieDict.p_lskey ||
        cookieDict.lskey ||
        "";

    let h = 5381;
    for (let i = 0; i < src.length; i++) {
        h += (h << 5) + src.charCodeAt(i);
    }
    return h & 2147483647;
}

function makeUiToken(): string {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
        const value = Math.floor(Math.random() * 16);
        return (ch === "x" ? value : (value & 0x3) | 0x8).toString(16).toUpperCase();
    });
}

function getCookieValue(setCookies: string[] | undefined, key: string): string {
    if (!setCookies) return "";
    for (const cookie of setCookies) {
        const match = cookie.match(new RegExp(`${key}=([^;]+)`));
        if (match) return match[1];
    }
    return "";
}

function mergeSetCookies(cookieDict: Record<string, string>, setCookies: string[] | undefined): void {
    if (!setCookies) return;
    for (const cookie of setCookies) {
        const firstPart = cookie.split(";")[0];
        const index = firstPart.indexOf("=");
        if (index <= 0) continue;

        const key = firstPart.slice(0, index).trim();
        const value = firstPart.slice(index + 1).trim();
        if (!value || value === '""' || value === "deleted" || value === "null") continue;

        cookieDict[key] = value;
    }
}

function buildCookieHeader(cookieDict: Record<string, string>): string {
    return serializeCookieMap(cookieDict);
}

function buildXloginUrl(redirectUrl: string): string {
    return (
        `https://xui.ptlogin2.qq.com/cgi-bin/xlogin` +
        `?appid=${QR_APPID}&daid=${QR_DAID}&style=33` +
        `&login_text=%E7%99%BB%E5%BD%95&hide_title_bar=1&hide_border=1&target=self` +
        `&s_url=${encodeURIComponent(redirectUrl)}&pt_3rd_aid=${QR_THIRD_AID}`
    );
}

function buildPopupLoginUrl(): string {
    return (
        `${buildXloginUrl(QR_LOGIN_JUMP_URL)}` +
        `&pt_feedback_link=${encodeURIComponent(QR_FEEDBACK_URL)}&theme=2&verify_theme=`
    );
}

function parseJsonSafe(data: unknown): any {
    if (typeof data !== "string") return data;
    try {
        return JSON.parse(data);
    } catch {
        return null;
    }
}

async function exchangeMusicCookies(cookieDict: Record<string, string>): Promise<void> {
    const musicUin = cookieDict.uin || cookieDict.p_uin || "";
    if (!musicUin) return;

    const params = new URLSearchParams({
        from: "1",
        force_access: "1",
        wxopenid: cookieDict.wxopenid || musicUin,
        wxrefresh_token: cookieDict.wxrefresh_token || "",
        musickey: cookieDict.qqmusic_key || cookieDict.qm_keyst || cookieDict.p_lskey || "",
        musicuin: musicUin,
        get_access_token: "1",
        ct: "1001",
        format: "json",
        inCharset: "utf-8",
        outCharset: "utf-8",
    });

    const response = await axios.get(
        `https://c.y.qq.com/base/fcgi-bin/login_get_musickey.fcg?${params}`,
        {
            headers: {
                "User-Agent": QR_UA,
                Referer: "https://y.qq.com/",
                Cookie: buildCookieHeader(cookieDict),
            },
            validateStatus: () => true,
        },
    );

    mergeSetCookies(cookieDict, response.headers["set-cookie"]);
    if (response.status !== 200) {
        logWarn(TAG, "login_get_musickey rejected", { status: response.status });
        return;
    }

    const body = parseJsonSafe(response.data);
    logInfo(TAG, "login_get_musickey completed", {
        status: response.status,
        code: body?.code,
        hasSetCookie: !!response.headers["set-cookie"]?.length,
    });

    const fields: Record<string, string | undefined> = {
        qqmusic_key: body?.key || body?.musickey || body?.qqmusic_key,
        qm_keyst: body?.key || body?.musickey || body?.qm_keyst,
        psrf_qqaccess_token: body?.wxaccess_token || body?.qqaccess_token || body?.access_token,
        psrf_qqrefresh_token: body?.wxrefresh_token || body?.qqrefresh_token || body?.refresh_token,
        psrf_qqopenid: body?.openid || body?.qqopenid,
        psrf_qqunionid: body?.unionid || body?.qqunionid,
    };
    for (const [key, value] of Object.entries(fields)) {
        if (value) cookieDict[key] = value;
    }

    if (!cookieDict.login_type) cookieDict.login_type = "1";
    if (!cookieDict.tmeLoginType) cookieDict.tmeLoginType = cookieDict.wxopenid ? "1" : "2";
}

async function exchangeQQConnectMusicLogin(code: string, cookieDict: Record<string, string>): Promise<void> {
    const payload = {
        comm: { g_tk: getGToken(cookieDict), platform: "yqq", ct: 24, cv: 0 },
        req: { module: "QQConnectLogin.LoginServer", method: "QQLogin", param: { code } },
    };

    const response = await axios.post("https://u.y.qq.com/cgi-bin/musicu.fcg", payload, {
        headers: {
            "User-Agent": QR_UA,
            Referer: "https://y.qq.com/portal/wx_redirect.html",
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: buildCookieHeader(cookieDict),
        },
        transformRequest: [(data) => JSON.stringify(data)],
        validateStatus: () => true,
    });

    mergeSetCookies(cookieDict, response.headers["set-cookie"]);
    const data = parseJsonSafe(response.data);
    logInfo(TAG, "QQConnectLogin.QQLogin completed", {
        status: response.status,
        code: data?.code,
        reqCode: data?.req?.code,
    });
}

async function authorizeQQConnect(cookieDict: Record<string, string>): Promise<string> {
    const redirectUri = `https://y.qq.com/portal/wx_redirect.html?login_type=1&surl=${encodeURIComponent(QR_TARGET_URL)}`;
    const form = new URLSearchParams({
        response_type: "code",
        client_id: QR_THIRD_AID,
        redirect_uri: redirectUri,
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

    const response = await axios.post("https://graph.qq.com/oauth2.0/authorize", form.toString(), {
        headers: {
            "User-Agent": QR_UA,
            Referer: "https://graph.qq.com/oauth2.0/show",
            "Content-Type": "application/x-www-form-urlencoded",
            Cookie: buildCookieHeader(cookieDict),
        },
        maxRedirects: 0,
        validateStatus: (status) => status >= 200 && status < 400,
    });

    mergeSetCookies(cookieDict, response.headers["set-cookie"]);
    return response.headers.location
        ? new URL(response.headers.location, "https://graph.qq.com/").toString()
        : "";
}

async function resolveQimeiH38(cookieDict: Record<string, string>): Promise<void> {
    if (cookieDict._qimei_h38) return;

    const uuid42 = cookieDict._qimei_uuid42 || "";
    const fingerprint = cookieDict._qimei_fingerprint || "";
    const uin = cookieDict.uin || "";

    try {
        const response = await axios.post(
            "https://qimei.qq.com/qimei/sdk/h5/multi",
            {
                appKey: "0AND2ADpTU4JiH",
                appVersion: "1.0.0",
                beaconId: uuid42,
                platform: "js",
                sdkVersion: "v1.3.3-beta.1",
                h_sdkVersion: "h1.2.0.81_rc",
                userId: uin,
                fp: fingerprint,
                timestamp: Date.now(),
            },
            {
                headers: {
                    "User-Agent": QR_UA,
                    Referer: "https://y.qq.com/",
                    "Content-Type": "application/json",
                    Cookie: buildCookieHeader(cookieDict),
                },
                timeout: 5000,
                validateStatus: () => true,
            },
        );

        mergeSetCookies(cookieDict, response.headers["set-cookie"]);
        const body = parseJsonSafe(response.data);
        const h38 = body?.data?.q38 || body?.data?.h38 || body?.q38 || body?.h38 || "";
        if (h38 && /^[0-9a-f]{38}$/i.test(h38)) {
            cookieDict._qimei_h38 = h38;
            logInfo(TAG, "_qimei_h38 obtained from QIMEI SDK", { prefix: h38.slice(0, 8) });
            return;
        }
    } catch {
        // Ignore QIMEI SDK failures and fall back to a derived value.
    }

    if (uuid42.length < 32) {
        logWarn(TAG, "Cannot derive _qimei_h38: uuid42 too short");
        return;
    }

    const prefix = uuid42.slice(0, 8);
    const deviceShard = uuid42.slice(16, 32);
    const suffix = "0200000521a30a";
    cookieDict._qimei_h38 = prefix + deviceShard + suffix;
    logInfo(TAG, "_qimei_h38 derived from uuid42", { prefix });
}

export async function getLoginQrCode(): Promise<{ image: string; qrsig: string }> {
    try {
        cleanupQrContexts();

        const xloginUrl = buildPopupLoginUrl();
        const xloginResponse = await axios.get(xloginUrl, {
            headers: { "User-Agent": QR_UA, Referer: "https://graph.qq.com/" },
            validateStatus: (status) => status >= 200 && status < 500,
        });

        const cookieDict: Record<string, string> = {};
        mergeSetCookies(cookieDict, xloginResponse.headers["set-cookie"]);
        const loginSig = getCookieValue(xloginResponse.headers["set-cookie"], "pt_login_sig");

        const qrShowUrl = (
            `https://xui.ptlogin2.qq.com/ssl/ptqrshow` +
            `?appid=${QR_APPID}&e=2&l=M&s=3&d=72&v=4&t=${Math.random()}` +
            `&daid=${QR_DAID}&pt_3rd_aid=${QR_THIRD_AID}&u1=${encodeURIComponent(QR_LOGIN_JUMP_URL)}`
        );
        const qrResponse = await axios.get(qrShowUrl, {
            responseType: "arraybuffer",
            headers: {
                "User-Agent": QR_UA,
                Referer: xloginUrl,
                Cookie: buildCookieHeader(cookieDict),
            },
            validateStatus: () => true,
        });

        if (qrResponse.status !== 200) {
            throw new Error(`QR endpoint returned status ${qrResponse.status}`);
        }

        const qrsig = getCookieValue(qrResponse.headers["set-cookie"], "qrsig");
        if (!qrsig) {
            throw new Error("qrsig is missing from QR response");
        }

        mergeSetCookies(cookieDict, qrResponse.headers["set-cookie"]);
        qrContextMap.set(qrsig, {
            loginSig,
            xloginUrl,
            cookieDict,
            createdAt: Date.now(),
        });

        return {
            image: `data:image/png;base64,${Buffer.from(qrResponse.data).toString("base64")}`,
            qrsig,
        };
    } catch (err) {
        logError(TAG, "getLoginQrCode failed", err);
        throw new Error("Failed to get login QR code");
    }
}

export async function checkQrStatus(
    qrsig: string,
): Promise<{ status: number; message: string; cookie?: string }> {
    try {
        cleanupQrContexts();

        const ctx = qrContextMap.get(qrsig);
        const xloginUrl = ctx?.xloginUrl || buildPopupLoginUrl();
        const ptqrtoken = hash33(qrsig);

        if (!ctx) {
            logWarn(TAG, "QR context not found", { qrsig: `${qrsig.slice(0, 10)}...` });
        }

        const query = new URLSearchParams({
            u1: QR_LOGIN_JUMP_URL,
            ptqrtoken: String(ptqrtoken),
            ptredirect: "0",
            h: "1",
            t: "1",
            g: "1",
            from_ui: "1",
            ptlang: "2052",
            action: `0-0-${Date.now()}`,
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
        const loginResponse = await axios.get(
            `https://xui.ptlogin2.qq.com/ssl/ptqrlogin?${query}`,
            {
                headers: {
                    "User-Agent": QR_UA,
                    Referer: xloginUrl,
                    Cookie: buildCookieHeader(requestCookies),
                },
                validateStatus: () => true,
            },
        );

        if (loginResponse.status !== 200) {
            logWarn(TAG, "ptqrlogin rejected", { status: loginResponse.status });
            return { status: 66, message: "QR status endpoint rejected, please refresh and retry" };
        }

        const parts = (String(loginResponse.data).match(/'(.*?)'/g) ?? []).map((value) => value.replace(/'/g, ""));
        if (parts.length < 5) {
            return { status: 66, message: "Failed to parse QR status response" };
        }

        const statusCode = Number(parts[0]);
        const statusMessage = parts[4];
        if (statusCode !== 0) {
            if (statusCode === 65 || statusCode === 67) {
                qrContextMap.delete(qrsig);
            }
            return { status: statusCode, message: statusMessage };
        }

        logInfo(TAG, "QR scanned, starting cookie exchange", { jumpUrl: parts[2] });

        const cookieDict: Record<string, string> = { ...requestCookies };
        mergeSetCookies(cookieDict, loginResponse.headers["set-cookie"]);
        if (ctx?.loginSig) {
            cookieDict.pt_login_sig = ctx.loginSig;
        }

        const redirectHistory: string[] = [];
        let lastVisitedUrl = "";

        const followRedirects = async (entryUrl: string, maxSteps = 8) => {
            let current = entryUrl;
            for (let step = 0; step < maxSteps; step += 1) {
                redirectHistory.push(current);
                const response = await axios.get(current, {
                    headers: {
                        "User-Agent": QR_UA,
                        Referer: "https://y.qq.com/",
                        ...BROWSER_HEADERS,
                        Cookie: buildCookieHeader(cookieDict),
                    },
                    maxRedirects: 0,
                    validateStatus: (status) => status >= 200 && status < 400,
                });

                mergeSetCookies(cookieDict, response.headers["set-cookie"]);
                lastVisitedUrl = current;

                if (response.status >= 300 && response.headers.location) {
                    current = new URL(response.headers.location, current).toString();
                    lastVisitedUrl = current;
                    continue;
                }
                break;
            }
        };

        const extractCode = (url: string) => {
            try {
                return new URL(url).searchParams.get("code") || "";
            } catch {
                return "";
            }
        };

        const jumpUrl = parts[2];
        if (jumpUrl) {
            await followRedirects(jumpUrl);
        }

        let qqLoginCode =
            redirectHistory.map(extractCode).find(Boolean) ||
            extractCode(lastVisitedUrl) ||
            extractCode(jumpUrl) ||
            "";

        if (!qqLoginCode) {
            const authorizeLocation = await authorizeQQConnect(cookieDict);
            if (authorizeLocation) {
                redirectHistory.push(authorizeLocation);
                qqLoginCode = extractCode(authorizeLocation);
                await followRedirects(authorizeLocation);
            }
        }

        if (qqLoginCode) {
            logInfo(TAG, "Exchanging QQ Connect code for music cookies", {
                code: `${qqLoginCode.slice(0, 10)}...`,
            });
            await exchangeQQConnectMusicLogin(qqLoginCode, cookieDict);
        } else {
            logWarn(TAG, "QQ Connect code not found in redirect chain", {
                jumpUrl,
                lastVisitedUrl,
                history: redirectHistory.slice(0, 12),
            });
        }

        logInfo(TAG, "Fetching final music cookies");
        await followRedirects("https://y.qq.com/");
        await followRedirects(QR_TARGET_URL);
        await exchangeMusicCookies(cookieDict);
        await followRedirects("https://y.qq.com/");
        await followRedirects(QR_TARGET_URL);
        await resolveQimeiH38(cookieDict);

        const uin = extractUin(buildCookieHeader(cookieDict));
        if (uin) {
            cookieDict.uin = uin;
        } else {
            logWarn(TAG, "uin extraction failed after redirect chain", {
                keys: Object.keys(cookieDict),
            });
        }

        delete cookieDict.qrsig;
        delete cookieDict.pt_login_sig;

        const finalCookie = serializeCookieMap(cookieDict);
        logInfo(TAG, "QR login succeeded", summarizeCookie(finalCookie));
        qrContextMap.delete(qrsig);

        return { status: 0, message: statusMessage, cookie: finalCookie };
    } catch (err) {
        logError(TAG, "checkQrStatus failed", err);
        throw new Error("Failed to check QR status");
    }
}
