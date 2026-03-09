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

// ----- Cookie 持久化存储 -----
const COOKIES_FILE = path.join(process.cwd(), '.qq_cookies.json');
let persistentCookies: Record<string, string> = {};

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

/** 内存中的房间存储 */
const rooms = new Map<string, Room>();

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
    logInfo(TAG, "房间已创建", { roomId: id, roomName: name, host: hostName });
    return { id, existing: false };
}

export function getRoom(roomId: string): Room | undefined {
    return rooms.get(roomId);
}

export function deleteRoom(roomId: string): void {
    const room = rooms.get(roomId);
    if (room) {
        logInfo(TAG, "房间已销毁（空房自动清理）", { roomId, roomName: room.name });
        rooms.delete(roomId);
    }
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

    logInfo(TAG, "房间 Cookie 已更新并持久化", {
        roomId: room.id,
        qqId: room.hostQQId || '(已清除)',
        hasCookie: !!room.hostCookie,
    });
}

// ----- 播放控制 -----

export async function playNextSong(room: Room, roomId: string, io: Server): Promise<void> {
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
        });
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
        logInfo(TAG, "播放队列已清空", { roomId });
    }
    io.to(roomId).emit("room_state", getSafeRoomState(room));
}

/**
 * 从推荐歌单中随机获取一首歌
 */
async function fetchRecommendedSong(room: Room): Promise<Song | null> {
    const uin = qqMusicService.extractUin(room.hostCookie!);
    let songlistId = '';

    // 优先使用用户自己的歌单
    if (uin) {
        try {
            const userDetail: any = await qqMusicService.getUserDetail(uin);
            if (userDetail?.mymusic?.length > 0) {
                songlistId = userDetail.mymusic[0].id;
            } else {
                const userPlaylists: any = await qqMusicService.getUserSonglist(uin);
                if (userPlaylists?.list?.length > 0) {
                    songlistId = userPlaylists.list[0].tid;
                }
            }
        } catch (e) {
            logError(TAG, "获取用户歌单失败，将使用推荐歌单", e, { uin });
        }
    }

    // 回退到推荐歌单
    if (!songlistId) {
        const result: any = await qqMusicService.getRecommendPlaylist(room.hostCookie);
        if (result?.list?.length > 0) {
            const randomPlaylist = result.list[Math.floor(Math.random() * result.list.length)];
            songlistId = randomPlaylist.content_id;
        }
    }

    if (!songlistId) return null;

    const playlistResult: any = await qqMusicService.getSonglistDetail(songlistId, room.hostCookie);
    if (!playlistResult?.songlist?.length) return null;

    const randomSong = playlistResult.songlist[Math.floor(Math.random() * playlistResult.songlist.length)];
    return {
        id: Date.now().toString(),
        songmid: randomSong.songmid,
        songname: randomSong.songname,
        singer: formatSinger(randomSong.singer),
        albumname: randomSong.albumname,
        albummid: randomSong.albummid,
        requestedBy: '自动推荐',
    };
}
