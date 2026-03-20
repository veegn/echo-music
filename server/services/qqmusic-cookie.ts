import { logInfo, logWarn } from "../logger.js";

const TAG = "QQMusicCookie";

export class CookieExpiredError extends Error {
    constructor(message = "登录已失效，请重新扫码登录") {
        super(message);
        this.name = "CookieExpiredError";
    }
}

export function isCookieError(code: number | string | undefined): boolean {
    return [301, -1310, 500003, 500005].includes(Number(code));
}

const COOKIE_ATTRIBUTE_KEYS = new Set([
    "path",
    "domain",
    "expires",
    "max-age",
    "samesite",
    "secure",
    "httponly",
    "priority",
    "partitioned",
]);

const COOKIE_PREFERRED_ORDER = [
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
    "login_type",
    "tmeLoginType",
];

export function extractUinFromCookieMap(cookieMap: Record<string, string>): string {
    const raw =
        cookieMap.uin ||
        cookieMap.ptui_loginuin ||
        cookieMap.pt2gguin ||
        cookieMap.superuin ||
        cookieMap.p_uin ||
        cookieMap.qqmusic_uin ||
        "";

    return raw.replace(/^o0*/, "").replace(/"/g, "");
}

export function parseCookieMap(cookie: string): Record<string, string> {
    const cookieMap: Record<string, string> = {};
    if (!cookie) {
        return cookieMap;
    }

    const normalized = cookie
        .replace(/\r?\n/g, ";")
        .replace(/[;,]\s*(?=expires=)/gi, "; expires=");

    for (const raw of normalized.split(";")) {
        const part = raw.trim();
        if (!part || !part.includes("=")) {
            continue;
        }

        const eqIdx = part.indexOf("=");
        const key = part.slice(0, eqIdx).trim();
        const value = part.slice(eqIdx + 1).trim();

        if (!key || COOKIE_ATTRIBUTE_KEYS.has(key.toLowerCase())) {
            continue;
        }
        if (!value || value === '""' || value === "deleted" || value === "null") {
            continue;
        }

        cookieMap[key] = value;
    }

    const uin = extractUinFromCookieMap(cookieMap);
    if (uin) {
        cookieMap.uin = uin;
    }

    if (!cookieMap.qqmusic_key && cookieMap.qm_keyst) {
        cookieMap.qqmusic_key = cookieMap.qm_keyst;
    }
    if (!cookieMap.qm_keyst && cookieMap.qqmusic_key) {
        cookieMap.qm_keyst = cookieMap.qqmusic_key;
    }

    if (!cookieMap.login_type) {
        cookieMap.login_type = "1";
    }
    if (!cookieMap.tmeLoginType) {
        cookieMap.tmeLoginType = cookieMap.wxopenid ? "1" : "2";
    }

    return cookieMap;
}

export function serializeCookieMap(cookieMap: Record<string, string>): string {
    const orderMap = new Map(COOKIE_PREFERRED_ORDER.map((key, index) => [key, index]));

    return Object.entries(cookieMap)
        .filter(([, value]) => !!value)
        .sort(([a], [b]) => {
            const ai = orderMap.get(a) ?? 999;
            const bi = orderMap.get(b) ?? 999;
            return ai !== bi ? ai - bi : a.localeCompare(b);
        })
        .map(([key, value]) => `${key}=${value}`)
        .join("; ");
}

export function normalizeCookie(cookie: string): string {
    return serializeCookieMap(parseCookieMap(cookie));
}

export function extractUin(cookie: string): string {
    return extractUinFromCookieMap(parseCookieMap(cookie));
}

export function summarizeCookie(cookie: string): Record<string, unknown> {
    const preview = (value: string | undefined, visible = 6) =>
        value ? `${value.slice(0, visible)}...(${value.length})` : "";
    const values = parseCookieMap(cookie);

    return {
        keyCount: Object.keys(values).length,
        keys: Object.keys(values),
        uin: values.uin || values.p_uin || "",
        qqmusic_key: preview(values.qqmusic_key),
        qm_keyst: preview(values.qm_keyst),
        psrf_qqopenid: preview(values.psrf_qqopenid),
        psrf_qqaccess_token: preview(values.psrf_qqaccess_token),
        ptcz: preview(values.ptcz),
        RK: preview(values.RK),
    };
}

export async function verifyCookie(cookie: string): Promise<{ success: boolean; message?: string }> {
    const normalized = normalizeCookie(cookie);
    const uin = extractUin(normalized);
    if (!uin) {
        logWarn(TAG, "Cookie validation failed: missing uin");
        return { success: false, message: "Cookie missing uin" };
    }

    const map = parseCookieMap(normalized);
    const authKeys = ["qqmusic_key", "qm_keyst", "p_skey", "skey", "p_lskey", "lskey"];
    if (!authKeys.some((key) => !!map[key])) {
        logWarn(TAG, "Cookie validation failed: missing auth key", {
            uin,
            keys: Object.keys(map),
        });
        return { success: false, message: "Cookie missing auth key" };
    }

    logInfo(TAG, "Cookie validation passed", { uin, keyCount: Object.keys(map).length });
    return { success: true };
}
