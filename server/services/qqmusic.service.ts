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
    const uinMatch =
        normalized.match(/(?:^|;| )uin=([^;]+)/) ||
        normalized.match(/(?:^|;| )ptui_loginuin=([^;]+)/) ||
        normalized.match(/(?:^|;| )pt2gguin=([^;]+)/) ||
        normalized.match(/(?:^|;| )superuin=([^;]+)/) ||
        normalized.match(/(?:^|;| )p_uin=([^;]+)/);
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
    try {
        applyRoomCookie(roomCookie);
        const result = await QQMusic.api("/song/url", { id: songmid });

        // 增强日志，输出 API 返回的原始数据结构
        logInfo(TAG, "歌曲链接 API 返回内容预览", {
            hasData: !!result?.data,
            dataType: typeof result?.data,
            midMatch: !!(result?.data && result.data[songmid])
        });

        // 某些版本的 API 可能返回 result.data 作为数组或对象，这里做兼容处理
        return result;
    } catch (err: any) {
        logError(TAG, "调用 QQMusic.api 获取 URL 抛出异常", err, { songmid });
        throw err;
    }
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
    try {
        const result = await QQMusic.api("/lyric", { songmid });
        return result;
    } catch (err: any) {
        logWarn(TAG, "获取歌词异常 (可能是Base64解码失败或无歌词)", { songmid, msg: err.message });
        // 返回符合前端期望的空歌词格式，避免服务崩溃
        return { lyric: "", trans: "" };
    }
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
/**
 * 获取电台分类
 */
export async function getRadioCategories(): Promise<any> {
    logInfo(TAG, "获取电台分类");
    const result = await QQMusic.api("/radio/category");
    return result;
}

/**
 * 获取电台歌曲
 */
export async function getRadioSongs(id: string, roomCookie: string | null): Promise<any> {
    logInfo(TAG, "获取电台歌曲", { id, hasCookie: !!roomCookie });
    applyRoomCookie(roomCookie);
    const result = await QQMusic.api("/radio", { id });
    return result;
}

/**
 * 获取搜索热词
 */
export async function getHotSearch(): Promise<any> {
    logInfo(TAG, "获取搜索热词");
    const result = await QQMusic.api("/search/hot");
    return result;
}

/**
 * ==========================================================
 * 以下为辅助 QQ音乐 APP 扫码登录的逆向 API 及工具方法
 * ==========================================================
 */
import axios from "axios";

// 计算 ptqrtoken (一种针对 qrsig 的 js 哈希算法，QQ 通用)
function hash33(qrsig: string): number {
    let hash = 0;
    for (let i = 0; i < qrsig.length; i++) {
        hash += (hash << 5) + qrsig.charCodeAt(i);
    }
    return hash & 2147483647;
}

/**
 * 第 1 步：获取 QQ 登录二维码图片及令牌 (qrsig)
 */
export async function getLoginQrCode(): Promise<{ image: string; qrsig: string }> {
    try {
        // 使用网页版 AppID (716027609) 并指定回调 y.qq.com 以获取播放令牌
        const url = "https://xui.ptlogin2.qq.com/ssl/ptqrshow?appid=716027609&e=2&l=M&s=3&d=72&v=4&t=" + Math.random() + "&daid=383&pt_3rd_aid=100497308&u1=https%3A%2F%2Fy.qq.com%2Fportal%2Fprofile.html";
        const response = await axios.get(url, {
            responseType: "arraybuffer",
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
                "Referer": "https://xui.ptlogin2.qq.com/cgi-bin/xlogin?appid=716027609&daid=383&style=33&login_text=%E7%99%BB%E5%BD%95&hide_title_bar=1&hide_border=1&target=self&s_url=https%3A%2F%2Fy.qq.com%2Fportal%2Fprofile.html&pt_3rd_aid=100497308"
            }
        });
        const setCookieHeaders = response.headers["set-cookie"] || [];
        let qrsig = "";
        for (const cookieStr of setCookieHeaders) {
            const match = cookieStr.match(/qrsig=([^;]+)/);
            if (match) {
                qrsig = match[1];
                break;
            }
        }
        const base64Image = Buffer.from(response.data, "binary").toString("base64");
        const imageSrc = `data:image/png;base64,${base64Image}`;
        return { image: imageSrc, qrsig };
    } catch (err) {
        logError(TAG, "获取扫码图片失败", err);
        throw new Error("无法获取登录二维码");
    }
}

/**
 * 第 2 步：轮询检查二维码的扫描和授权状态
 */
export async function checkQrStatus(qrsig: string): Promise<{ status: number; message: string; cookie?: string }> {
    try {
        const action = `0-0-${Date.now()}`;
        const ptqrtoken = hash33(qrsig);
        const url = `https://xui.ptlogin2.qq.com/ssl/ptqrlogin?u1=https%3A%2F%2Fy.qq.com%2Fportal%2Fprofile.html&ptqrtoken=${ptqrtoken}&ptredirect=0&h=1&t=1&g=1&from_ui=1&ptlang=2052&action=${action}&js_ver=26030415&js_type=1&login_sig=s24UxAgn1LoXVH7q1jMTdz4qOQ5mu-aCDbOqjUyB8KOez9*l6U7G8MB38JDvvk5M&pt_uistyle=40&aid=716027609&daid=383&pt_3rd_aid=100497308&&o1vId=f5f68a7cf83ec11b10bc76f20647cc2d&pt_js_version=b515fdc3`;

        const response = await axios.get(url, {
            headers: {
                "Cookie": `qrsig=${qrsig};`,
                "Referer": "https://xui.ptlogin2.qq.com/cgi-bin/xlogin?appid=716027609",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36"
            }
        });
        const dataStr = response.data;
        const pts = dataStr.match(/'(.*?)'/g)?.map((s: string) => s.replace(/'/g, "")) || [];

        if (!pts || pts.length < 5) {
            return { status: 66, message: "解析状态失败等待重试" };
        }

        const statusCode = parseInt(pts[0], 10);
        const statusMsg = pts[4];

        if (statusCode === 0) {
            // 1. 聚合 Cookie 容器
            const cookieDict: Record<string, string> = { qrsig };
            const updateCookies = (setCookies: string[] | undefined) => {
                if (!setCookies) return;
                setCookies.forEach(c => {
                    const firstPart = c.split(';')[0];
                    const eqIdx = firstPart.indexOf('=');
                    if (eqIdx > 0) {
                        const key = firstPart.substring(0, eqIdx).trim();
                        const val = firstPart.substring(eqIdx + 1).trim();
                        if (val && val !== '""' && val !== 'deleted' && val !== 'null') {
                            cookieDict[key] = val;
                        }
                    }
                });
            };

            updateCookies(response.headers['set-cookie']);

            // 2. 辅助函数：跟随跳转链
            const followRedirects = async (targetUrl: string, limit = 5) => {
                let currentUrl = targetUrl;
                for (let i = 0; i < limit; i++) {
                    try {
                        const res = await axios.get(currentUrl, {
                            headers: {
                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
                                "Cookie": Object.entries(cookieDict).map(([k, v]) => `${k}=${v}`).join('; '),
                                "Referer": "https://xui.ptlogin2.qq.com/"
                            },
                            maxRedirects: 0,
                            validateStatus: (s) => s < 400
                        });
                        updateCookies(res.headers['set-cookie']);
                        if (res.status === 302 && res.headers.location) {
                            let next = res.headers.location;
                            if (next.startsWith('/')) {
                                const u = new URL(currentUrl);
                                next = `${u.protocol}//${u.host}${next}`;
                            }
                            currentUrl = next;
                        } else break;
                    } catch (e) { break; }
                }
            };

            // 3. 执行初始跳转以换票
            logInfo(TAG, "正在跟随登录跳转链...", { jumpUrl: pts[2] });
            await followRedirects(pts[2]);

            // 4. 强制二次换票：如果仍缺 y.qq.com 令牌，主动执行音乐授权
            if (!cookieDict['qm_keyst'] && cookieDict['p_skey']) {
                logInfo(TAG, "未检出音乐令牌，正在执行 OAuth 二次换票...");
                const authUrl = `https://graph.qq.com/oauth2.0/authorize?response_type=code&client_id=100497308&redirect_uri=https%3A%2F%2Fy.qq.com%2Fportal%2Fprofile.html&state=login&display=pc`;
                await followRedirects(authUrl, 3);
            }

            // 5. 规范化 UIN
            const finalUin = extractUin(Object.entries(cookieDict).map(([k, v]) => `${k}=${v}`).join('; '));
            if (finalUin) {
                cookieDict['uin'] = finalUin;
            }

            const finalCookieStr = Object.entries(cookieDict)
                .filter(([k]) => k !== 'qrsig')
                .map(([k, v]) => `${k}=${v}`)
                .join('; ');

            logInfo(TAG, "扫码登录流程结束", { uin: finalUin, cookieCount: Object.keys(cookieDict).length });
            return { status: 0, message: statusMsg, cookie: finalCookieStr };
        }
        return { status: statusCode, message: statusMsg };

    } catch (err) {
        logError(TAG, "检查二维码状态异常", err);
        throw new Error("检查二维码状态失败");
    }
}
