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
    : path.join(process.cwd(), "server", "storage");
const ROOMS_DIR = path.join(STORAGE_DIR, "rooms");
const LEGACY_ROOMS_FILE = path.join(STORAGE_DIR, "rooms.json");

const rooms = new Map<string, Room>();
const destructionTimers = new Map<string, NodeJS.Timeout>();
const dirtyRoomIds = new Set<string>();
let flushTimer: NodeJS.Timeout | null = null;

function ensureRoomsDir(): void {
    if (!fs.existsSync(ROOMS_DIR)) {
        fs.mkdirSync(ROOMS_DIR, { recursive: true });
    }
}

function getRoomFilePath(roomId: string): string {
    return path.join(ROOMS_DIR, `${roomId}.json`);
}

function persistableRoom(room: Room): Room {
    return {
        ...room,
        users: [],
        isPlaying: false,
        currentTime: 0,
    };
}

function flushDirtyRooms(): void {
    ensureRoomsDir();

    for (const roomId of Array.from(dirtyRoomIds)) {
        const room = rooms.get(roomId);
        const filePath = getRoomFilePath(roomId);

        try {
            if (!room) {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            } else {
                const tmpFilePath = `${filePath}.tmp`;
                fs.writeFileSync(tmpFilePath, JSON.stringify(persistableRoom(room), null, 2));
                fs.renameSync(tmpFilePath, filePath);
            }
            dirtyRoomIds.delete(roomId);
        } catch (error) {
            logError(TAG, "Failed to persist room file", error, { roomId, filePath });
        }
    }

    logInfo(TAG, "Room files flushed", {
        count: rooms.size,
        dirPath: ROOMS_DIR,
    });
}

function scheduleFlush(roomIds?: string | string[]): void {
    const ids = Array.isArray(roomIds)
        ? roomIds
        : roomIds
            ? [roomIds]
            : Array.from(rooms.keys());

    ids.forEach((roomId) => dirtyRoomIds.add(roomId));

    if (flushTimer) {
        clearTimeout(flushTimer);
    }

    flushTimer = setTimeout(() => {
        flushTimer = null;
        flushDirtyRooms();
    }, 250);
}

function generateRoomId(): string {
    return crypto.randomBytes(4).toString("hex");
}

function migrateLegacyRoomsIfNeeded(): void {
    ensureRoomsDir();
    const hasRoomFiles = fs.readdirSync(ROOMS_DIR).some((file) => file.endsWith(".json"));
    if (hasRoomFiles || !fs.existsSync(LEGACY_ROOMS_FILE)) {
        return;
    }

    try {
        const data = JSON.parse(fs.readFileSync(LEGACY_ROOMS_FILE, "utf-8"));
        for (const [id, room] of Object.entries(data)) {
            const filePath = getRoomFilePath(id);
            fs.writeFileSync(filePath, JSON.stringify(room, null, 2));
        }
        fs.renameSync(LEGACY_ROOMS_FILE, `${LEGACY_ROOMS_FILE}.migrated`);
        logInfo(TAG, "Migrated legacy rooms.json to per-room files", {
            count: Object.keys(data).length,
            dirPath: ROOMS_DIR,
        });
    } catch (error) {
        logError(TAG, "Failed to migrate legacy rooms.json", error);
    }
}

function loadRoomsFromDisk(): void {
    ensureRoomsDir();
    migrateLegacyRoomsIfNeeded();

    try {
        const files = fs.readdirSync(ROOMS_DIR).filter((file) => file.endsWith(".json"));
        for (const file of files) {
            const filePath = path.join(ROOMS_DIR, file);
            const room = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            rooms.set(room.id, {
                ...room,
                users: [],
                isPlaying: false,
                currentTime: 0,
                hostCookie: room.hostCookie || null,
                hostQQId: room.hostQQId || "",
            });
            scheduleRoomDestruction(room.id, 60 * 60 * 1000);
        }
        logInfo(TAG, "Rooms loaded from storage", { count: rooms.size, dirPath: ROOMS_DIR });
    } catch (error) {
        logError(TAG, "Failed to load rooms", error);
    }
}

export function saveRooms(roomId?: string | string[]): void {
    scheduleFlush(roomId);
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
    saveRooms(id);
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
        saveRooms(roomId);
    }
}

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

    saveRooms(room.id);

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

        saveRooms(room.id);
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

                    saveRooms(room.id);
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
        saveRooms(room.id);
        logInfo(TAG, "Queue ended", { roomId });
    }

    io.to(roomId).emit("room_state", getSafeRoomState(room));
}

async function fetchRecommendedSong(room: Room): Promise<Song | null> {
    try {
        const result: any = await qqMusicService.getRadioSongs(room.hostCookie);
        const tracks = Array.isArray(result)
            ? result
            : Array.isArray(result?.tracks)
                ? result.tracks
                : [];

        if (tracks.length === 0) {
            logWarn(TAG, "No radio tracks available for auto play", { roomId: room.id });
            return null;
        }

        const nextSong = tracks[0];
        const songmid = nextSong.songmid || nextSong.mid || "";
        const songname = nextSong.songname || nextSong.title || nextSong.name || "";

        if (!songmid || !songname) {
            logWarn(TAG, "Invalid radio track payload for auto play", {
                roomId: room.id,
                trackKeys: nextSong ? Object.keys(nextSong) : [],
            });
            return null;
        }

        return {
            id: Date.now().toString(),
            songmid,
            songname,
            singer: formatSinger(nextSong.singer),
            albumname: nextSong.albumname || nextSong.album?.title || nextSong.album?.name || "Unknown Album",
            albummid: nextSong.albummid || nextSong.album?.mid || "",
            album: { mid: nextSong.albummid || nextSong.album?.mid },
            requestedBy: "Radio",
        };
    } catch (e: any) {
        logError(TAG, "Failed to fetch recommended song", e, { roomId: room.id });
    }

    return null;
}

loadRoomsFromDisk();

process.on("beforeExit", () => {
    try {
        flushDirtyRooms();
    } catch (error) {
        logError(TAG, "Failed to flush room files before exit", error);
    }
});

