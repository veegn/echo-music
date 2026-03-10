// ============================
// 房间服务层
// ============================
// 管理房间的增删查改及业务逻辑

import { Room, SafeRoomState, PublicRoomInfo, Song } from "../types.js";
import { logInfo, logWarn, logError } from "../logger.js";
import * as qqMusicService from "./qqmusic.service.js";
import { Server } from "socket.io";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const TAG = "RoomService";

// ----- 持久化存储路径 -----
const STORAGE_DIR = path.join(process.cwd(), 'server', 'storage');
const COOKIES_FILE = path.join(STORAGE_DIR, 'cookies.json');
const ROOMS_FILE = path.join(STORAGE_DIR, 'rooms.json');

// 保证存储目录存在
if (!fs.existsSync(STORAGE_DIR)) {
    try {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
    } catch (e) {
        logError(TAG, "创建存储目录失败", e as Error);
    }
}

let persistentCookies: Record<string, string> = {};

// 加载持久化 Cookie
try {
    if (fs.existsSync(COOKIES_FILE)) {
        persistentCookies = JSON.parse(fs.readFileSync(COOKIES_FILE, 'utf-8'));
    }
} catch (e) {
    logError(TAG, "加载持久化 Cookie 失败", e as Error);
}

function savePersistentCookies() {
    try {
        fs.writeFileSync(COOKIES_FILE, JSON.stringify(persistentCookies, null, 2));
    } catch (e) {
        logError(TAG, "保存持久化 Cookie 失败", e as Error);
    }
}

/** 内存中的房间存储 (带初始化加载) */
const rooms = new Map<string, Room>();


export function saveRooms() {
    try {
        const obj = Object.fromEntries(rooms);
        fs.writeFileSync(ROOMS_FILE, JSON.stringify(obj, null, 2));
    } catch (e) {
        logError(TAG, "保存房间数据失败", e as Error);
    }
}

/**
 * 生成 8 位随机房间 ID（比之前 6 位碰撞概率更低）
 */
function generateRoomId(): string {
    return crypto.randomBytes(4).toString('hex');
}

/**
 * 格式化歌手信息为统一字符串
 */
export function formatSinger(singer: unknown): string {
    if (Array.isArray(singer)) {
        return singer.map((s: any) => s.name || s).join(' / ');
    }
    if (typeof singer === 'string') return singer;
    return '未知歌手';
}

// ----- 房间 CRUD -----

/**
 * 检查是否存在同名房间（由同一房主创建且仍有人在线）
 */
export function findExistingRoom(name: string, hostName: string): Room | undefined {
    return Array.from(rooms.values()).find(r => r.name === name && r.hostName === hostName && r.users.length > 0);
}

export function createRoom(name: string, password: string, hostName: string): { id: string; existing: boolean } {
    // 检查是否已存在同名同主的活跃房间
    const existing = findExistingRoom(name, hostName);
    if (existing) {
        logInfo(TAG, "复用已存在的房间", { roomId: existing.id, roomName: name, host: hostName });
        return { id: existing.id, existing: true };
    }

    const id = generateRoomId();
    const savedCookie = persistentCookies[hostName] || null;
    const room: Room = {
        id,
        name,
        password,
        hostName,
        hostCookie: savedCookie,
        hostQQId: savedCookie ? qqMusicService.extractUin(savedCookie) : '',
        users: [],
        queue: [],
        currentSong: null,
        isPlaying: false,
        currentTime: 0,
        chat: [],
    };
    rooms.set(id, room);
    saveRooms(); // 持久化新房间
    scheduleRoomDestruction(id); // 刚创建时也是空房，如果房主不进入也应该5分钟后清理
    logInfo(TAG, "房间已创建", { roomId: id, roomName: name, host: hostName });
    return { id, existing: false };
}

export function getRoom(roomId: string): Room | undefined {
    return rooms.get(roomId);
}

export function deleteRoom(roomId: string): void {
    const room = rooms.get(roomId);
    if (room) {
        logInfo(TAG, "房间已销毁（超过5分钟空房或被手动清理）", { roomId, roomName: room.name });
        rooms.delete(roomId);
        cancelRoomDestruction(roomId); // 确保定时器被清理
        saveRooms(); // 移除持久化
    }
}

// ----- 房间销毁定时任务 -----
const destructionTimers = new Map<string, NodeJS.Timeout>();

export function scheduleRoomDestruction(roomId: string, limitMs: number = 5 * 60 * 1000): void {
    if (destructionTimers.has(roomId)) {
        clearTimeout(destructionTimers.get(roomId)!);
    }
    const timer = setTimeout(() => {
        logInfo(TAG, `空房间超过 ${limitMs / 60000} 分钟无人进入，执行自动清理`, { roomId });
        deleteRoom(roomId);
        destructionTimers.delete(roomId);
    }, limitMs);
    destructionTimers.set(roomId, timer);
}

export function cancelRoomDestruction(roomId: string): void {
    if (destructionTimers.has(roomId)) {
        clearTimeout(destructionTimers.get(roomId)!);
        destructionTimers.delete(roomId);
        logInfo(TAG, `房间已有用户加入，已取消自动销毁倒计时`, { roomId });
    }
}

// ----- 房间初始化加载 -----
try {
    if (fs.existsSync(ROOMS_FILE)) {
        const data = JSON.parse(fs.readFileSync(ROOMS_FILE, 'utf-8'));
        Object.entries(data).forEach(([id, room]: [string, any]) => {
            rooms.set(id, {
                ...room,
                users: [],
                isPlaying: false,
            });
            scheduleRoomDestruction(id);
        });
        logInfo(TAG, `已从持久化存储加载 ${rooms.size} 个房间`);
    }
} catch (e) {
    logError(TAG, "加载持久化房间失败", e as Error);
}

export function listPublicRooms(): PublicRoomInfo[] {
    return Array.from(rooms.values()).map(r => ({
        id: r.id,
        name: r.name,
        hostName: r.hostName,
        hasPassword: !!r.password,
        usersCount: r.users.length,
        currentSong: r.currentSong,
    }));
}

export function verifyRoomPassword(roomId: string, password: string): { success: boolean; error?: string } {
    const room = rooms.get(roomId);
    if (!room) return { success: false, error: "Room not found" };
    if (room.password && room.password !== password) {
        logWarn(TAG, "房间密码验证失败", { roomId });
        return { success: false, error: "Incorrect password" };
    }
    return { success: true };
}

// ----- 房间状态 -----

export function getSafeRoomState(room: Room): SafeRoomState {
    return {
        id: room.id,
        name: room.name,
        hostName: room.hostName,
        users: room.users,
        queue: room.queue,
        currentSong: room.currentSong,
        isPlaying: room.isPlaying,
        currentTime: room.currentTime,
        hasCookie: !!room.hostCookie,
        hostQQId: room.hostQQId,
        chat: room.chat,
    };
}

/**
 * 设置房间的 QQ 音乐 Cookie 并提取 QQ ID
 */
export function setRoomCookie(room: Room, cookie: string): void {
    room.hostCookie = cookie || null;
    room.hostQQId = cookie ? qqMusicService.extractUin(cookie) : '';

    // 固化存储
    if (cookie) {
        persistentCookies[room.hostName] = cookie;
    } else {
        delete persistentCookies[room.hostName];
    }
    savePersistentCookies();
    saveRooms(); // 同步更新房间持久化中的 cookie

    logInfo(TAG, "房间 Cookie 已更新并持久化", {
        roomId: room.id,
        qqId: room.hostQQId || '(已清除)',
        hasCookie: !!room.hostCookie,
    });
}

// ----- 播放控制 -----

export async function playNextSong(room: Room, roomId: string, io: Server, isAuto = false): Promise<void> {
    if (room.queue.length > 0) {
        room.currentSong = room.queue.shift()!;
        room.currentTime = 0;
        room.isPlaying = true;
        logInfo(TAG, "播放下一首（来自队列）", {
            roomId,
            songName: room.currentSong.songname,
            singer: room.currentSong.singer,
            requestedBy: room.currentSong.requestedBy,
            remainingQueue: room.queue.length,
            isAuto
        });

        saveRooms(); // 持久化更新
        io.to(roomId).emit("room_state", getSafeRoomState(room));

        // 如果不是自动播放下一曲，则提示正在播放
        if (!isAuto) {
            const msg = {
                id: Date.now(),
                type: "system" as const,
                text: `正在播放: ${room.currentSong.songname} - ${room.currentSong.singer}`
            };
            room.chat.push(msg);
            if (room.chat.length > 100) room.chat.shift();
            io.to(roomId).emit("chat_message", msg);
        }
    } else {
        // 队列为空，尝试自动推荐
        if (room.hostCookie) {
            try {
                const autoSong = await fetchRecommendedSong(room);
                if (autoSong) {
                    room.currentSong = autoSong;
                    room.currentTime = 0;
                    room.isPlaying = true;
                    logInfo(TAG, "自动推荐播放", {
                        roomId,
                        songName: autoSong.songname,
                        singer: autoSong.singer,
                    });
                    saveRooms(); // 持久化自动推荐
                    io.to(roomId).emit("room_state", getSafeRoomState(room));
                    return;
                }
            } catch (e) {
                logError(TAG, "自动推荐歌曲失败", e, { roomId });
            }
        }

        room.currentSong = null;
        room.isPlaying = false;
        room.currentTime = 0;
        saveRooms(); // 持久化清空
        logInfo(TAG, "播放队列已清空", { roomId });
    }
    io.to(roomId).emit("room_state", getSafeRoomState(room));
}

/**
 * 自动播放猜你喜欢电台
 */
async function fetchRecommendedSong(room: Room): Promise<Song | null> {
    try {
        logInfo(TAG, "尝试获取电台自动推荐", { roomId: room.id });
        // 尝试获取“猜你喜欢”电台 (id: 99)
        let result: any = await qqMusicService.getRadioSongs('99', room.hostCookie);

        // 如果猜你喜欢为空或授权失败（未登录时为空），回退到“热歌”电台 (id: 199)
        if (!result || !result.tracks || result.tracks.length === 0) {
            logWarn(TAG, "猜你喜欢电台为空，回退到热歌电台", { roomId: room.id });
            result = await qqMusicService.getRadioSongs('199', room.hostCookie);
        }

        if (result && result.tracks && result.tracks.length > 0) {
            // 从电台中随机挑选一首
            const randomSong = result.tracks[Math.floor(Math.random() * result.tracks.length)];

            return {
                id: Date.now().toString(),
                songmid: randomSong.mid,
                songname: randomSong.title || randomSong.name,
                singer: formatSinger(randomSong.singer),
                albumname: randomSong.album?.title || randomSong.album?.name || '未知专辑',
                albummid: randomSong.album?.mid || '',
                album: { mid: randomSong.album?.mid },
                requestedBy: '电台推荐 📻',
            };
        }
    } catch (e) {
        logError(TAG, "获取电台自动推荐失败", e, { roomId: room.id });
    }

    return null;
}
