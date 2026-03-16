import { Room, SafeRoomState, PublicRoomInfo, Song } from "../types.js";
import { logInfo, logWarn, logError } from "../logger.js";
import * as qqMusicService from "./qqmusic.service.js";
import { Server } from "socket.io";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const TAG = "RoomService";
const STORAGE_DIR = process.env.ECHO_MUSIC_STORAGE_DIR
    ? path.resolve(process.env.ECHO_MUSIC_STORAGE_DIR)
    : path.join(process.cwd(), 'server', 'storage');
const ROOMS_FILE = path.join(STORAGE_DIR, "rooms.json");

if (!fs.existsSync(STORAGE_DIR)) {
    try {
        fs.mkdirSync(STORAGE_DIR, { recursive: true });
    } catch (e) {
        logError(TAG, "Failed to create storage directory", e as Error);
    }
}

const rooms = new Map<string, Room>();

export function saveRooms() {
    try {
        const obj = Object.fromEntries(Array.from(rooms.entries()));
        fs.writeFileSync(ROOMS_FILE, JSON.stringify(obj, null, 2));
        logInfo(TAG, "Rooms saved to disk", { count: rooms.size, filePath: ROOMS_FILE });
    } catch (e) {
        logError(TAG, "Failed to save rooms", e as Error);
    }
}

function generateRoomId(): string {
    return crypto.randomBytes(4).toString("hex");
}

export function formatSinger(singer: unknown): string {
    if (Array.isArray(singer)) {
        return singer.map((s: any) => s.name || s).join(" / ");
    }
    if (typeof singer === "string") return singer;
    return "Unknown Artist";
}

export function findExistingRoom(name: string, hostName: string): Room | undefined {
    return Array.from(rooms.values()).find((r) => r.name === name && r.hostName === hostName && r.users.length > 0);
}

export function createRoom(name: string, password: string, hostName: string): { id: string; existing: boolean } {
    const existing = findExistingRoom(name, hostName);
    if (existing) {
        logInfo(TAG, "Reuse existing room", { roomId: existing.id, roomName: name, host: hostName });
        return { id: existing.id, existing: true };
    }

    const id = generateRoomId();
    const room: Room = {
        id,
        name,
        password,
        hostName,
        hostCookie: null,
        hostQQId: "",
        users: [],
        queue: [],
        currentSong: null,
        isPlaying: false,
        currentTime: 0,
        chat: [],
    };

    rooms.set(id, room);
    saveRooms();
    scheduleRoomDestruction(id);
    logInfo(TAG, "Room created", { roomId: id, roomName: name, host: hostName });
    return { id, existing: false };
}

export function getRoom(roomId: string): Room | undefined {
    return rooms.get(roomId);
}

export function deleteRoom(roomId: string): void {
    const room = rooms.get(roomId);
    if (room) {
        logInfo(TAG, "Room deleted", { roomId, roomName: room.name });
        rooms.delete(roomId);
        cancelRoomDestruction(roomId);
        saveRooms();
    }
}

const destructionTimers = new Map<string, NodeJS.Timeout>();

export function scheduleRoomDestruction(roomId: string, limitMs: number = 5 * 60 * 1000): void {
    if (destructionTimers.has(roomId)) {
        clearTimeout(destructionTimers.get(roomId)!);
    }

    const timer = setTimeout(() => {
        logInfo(TAG, "Destroy idle room", { roomId, idleMinutes: limitMs / 60000 });
        deleteRoom(roomId);
        destructionTimers.delete(roomId);
    }, limitMs);

    destructionTimers.set(roomId, timer);
}

export function cancelRoomDestruction(roomId: string): void {
    if (destructionTimers.has(roomId)) {
        clearTimeout(destructionTimers.get(roomId)!);
        destructionTimers.delete(roomId);
        logInfo(TAG, "Cancelled room destruction", { roomId });
    }
}

try {
    if (fs.existsSync(ROOMS_FILE)) {
        const data = JSON.parse(fs.readFileSync(ROOMS_FILE, "utf-8"));
        Object.entries(data).forEach(([id, room]: [string, any]) => {
            rooms.set(id, {
                ...room,
                users: [],
                isPlaying: false,
                hostCookie: room.hostCookie || null,
                hostQQId: room.hostQQId || "",
            });
            // ✅ 修复⑤：重启后给房间 60 分钟宽限期等待用户重连，而不是默认的 5 分钟
            // 一旦有用户加入，cancelRoomDestruction 会取消此定时器，断开时再以 5 分钟重置
            scheduleRoomDestruction(id, 60 * 60 * 1000);
        });
        logInfo(TAG, "Rooms loaded from storage", { count: rooms.size });
    }
} catch (e) {
    logError(TAG, "Failed to load rooms", e as Error);
}

export function listPublicRooms(): PublicRoomInfo[] {
    return Array.from(rooms.values()).map((r) => ({
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
        logWarn(TAG, "Room password verification failed", { roomId });
        return { success: false, error: "Incorrect password" };
    }
    return { success: true };
}

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

export function setRoomCookie(room: Room, cookie: string): void {
    const normalizedCookie = cookie ? qqMusicService.normalizeCookie(cookie) : "";
    room.hostCookie = normalizedCookie || null;
    room.hostQQId = normalizedCookie ? qqMusicService.extractUin(normalizedCookie) : "";

    // Metadata is persisted, but cookie/QQ id are always scrubbed in saveRooms.
    saveRooms();

    logInfo(TAG, "Room cookie updated", {
        roomId: room.id,
        qqId: room.hostQQId || "(cleared)",
        hasCookie: !!room.hostCookie,
    });
}

export async function verifyRoomCookie(cookie: string): Promise<{ success: boolean; message?: string }> {
    return qqMusicService.verifyCookie(cookie);
}

export async function playNextSong(room: Room, roomId: string, io: Server, isAuto = false): Promise<void> {
    if (room.queue.length > 0) {
        room.currentSong = room.queue.shift()!;
        room.currentTime = 0;
        room.isPlaying = true;

        logInfo(TAG, "Play next song from queue", {
            roomId,
            songName: room.currentSong.songname,
            singer: room.currentSong.singer,
            requestedBy: room.currentSong.requestedBy,
            remainingQueue: room.queue.length,
            isAuto,
        });

        saveRooms();
        io.to(roomId).emit("room_state", getSafeRoomState(room));

        if (!isAuto) {
            const msg = {
                id: Date.now(),
                type: "system" as const,
                text: `Now playing: ${room.currentSong.songname} - ${room.currentSong.singer}`,
            };
            room.chat.push(msg);
            if (room.chat.length > 100) room.chat.shift();
            io.to(roomId).emit("chat_message", msg);
        }
    } else {
        if (room.hostCookie) {
            try {
                const autoSong = await fetchRecommendedSong(room);
                if (autoSong) {
                    room.currentSong = autoSong;
                    room.currentTime = 0;
                    room.isPlaying = true;

                    logInfo(TAG, "Auto recommendation started", {
                        roomId,
                        songName: autoSong.songname,
                        singer: autoSong.singer,
                    });

                    saveRooms();
                    io.to(roomId).emit("room_state", getSafeRoomState(room));
                    return;
                }
            } catch (e) {
                logError(TAG, "Failed to auto-recommend song", e, { roomId });
            }
        }

        room.currentSong = null;
        room.isPlaying = false;
        room.currentTime = 0;
        saveRooms();
        logInfo(TAG, "Queue ended", { roomId });
    }

    io.to(roomId).emit("room_state", getSafeRoomState(room));
}

async function fetchRecommendedSong(room: Room): Promise<Song | null> {
    try {
        let result: any = await qqMusicService.getRadioSongs(room.hostCookie);

        if (result && result.tracks && result.tracks.length > 0) {
            const randomSong = result.tracks[Math.floor(Math.random() * result.tracks.length)];
            return {
                id: Date.now().toString(),
                songmid: randomSong.mid,
                songname: randomSong.title || randomSong.name,
                singer: formatSinger(randomSong.singer),
                albumname: randomSong.album?.title || randomSong.album?.name || "Unknown Album",
                albummid: randomSong.album?.mid || "",
                album: { mid: randomSong.album?.mid },
                requestedBy: "Radio",
            };
        }
    } catch (e: any) {
        logError(TAG, "Failed to fetch recommended song", e, { roomId: room.id });
    }

    return null;
}
