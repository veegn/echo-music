import { Room, SafeRoomState, PublicRoomInfo, Song } from "../types.js";
import { logInfo, logWarn, logError } from "../logger.js";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import * as qqMusicService from "./qqmusic.service.js";
import { config } from "../config.js";

const TAG = "RoomService";
const ROOMS_DIR = config.storage.roomsDir;
export const SYNC_LEASE_MS = config.room.syncLeaseMs;

const rooms = new Map<string, Room>();
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
        chat: [],
        syncLeaderId: "",
        syncLeaderName: ""
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
    }, config.storage.roomFlushDebounceMs);
}

function generateRoomId(): string {
    return crypto.randomBytes(4).toString("hex");
}

function getPreferredLeader(room: Room) {
    return room.users.find((user) => user.name === room.hostName) || room.users[0] || null;
}

export function bumpSyncVersion(room: Room): number {
    room.syncVersion += 1;
    return room.syncVersion;
}

export function isSyncLeaderActive(room: Room): boolean {
    return !!room.syncLeaderId
        && room.users.some((user) => user.id === room.syncLeaderId)
        && room.syncLeaseUntil > Date.now();
}

export function assignSyncLeader(room: Room, user: { id: string; name: string } | null, extendLease = true): boolean {
    const nextLeaderId = user?.id || "";
    const nextLeaderName = user?.name || "";
    const changed = room.syncLeaderId !== nextLeaderId;

    if (changed) {
        room.syncTerm += 1;
    }

    room.syncLeaderId = nextLeaderId;
    room.syncLeaderName = nextLeaderName;
    room.syncLeaseUntil = nextLeaderId && extendLease ? Date.now() + SYNC_LEASE_MS : 0;

    return changed;
}

export function renewSyncLeaderLease(room: Room): void {
    if (!room.syncLeaderId) return;
    room.syncLeaseUntil = Date.now() + SYNC_LEASE_MS;
}

export function ensureSyncLeader(room: Room): boolean {
    if (isSyncLeaderActive(room)) {
        return false;
    }

    const nextLeader = getPreferredLeader(room);
    return assignSyncLeader(room, nextLeader);
}

function loadRoomsFromDisk(): void {
    ensureRoomsDir();

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
                syncLeaderId: room.syncLeaderId || "",
                syncLeaderName: room.syncLeaderName || "",
                syncTerm: Number(room.syncTerm || 0),
                syncVersion: Number(room.syncVersion || 0),
                syncLeaseUntil: Number(room.syncLeaseUntil || 0),
                hostCookie: room.hostCookie || null,
                hostQQId: room.hostQQId || "",
            });
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
        syncLeaderId: "",
        syncLeaderName: "",
        syncTerm: 0,
        syncVersion: 0,
        syncLeaseUntil: 0,
        chat: [],
    };

    rooms.set(id, room);
    saveRooms(id);
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
        saveRooms(roomId);
    }
}

export function scheduleRoomDestruction(_roomId: string, _limitMs: number = config.room.idleDestructionMs): void {
    // Rooms are now persistent and never expire automatically.
}

export function cancelRoomDestruction(_roomId: string): void {
    // Rooms are now persistent and never expire automatically.
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
        syncLeaderId: room.syncLeaderId,
        syncLeaderName: room.syncLeaderName,
        syncTerm: room.syncTerm,
        syncVersion: room.syncVersion,
        syncLeaseUntil: room.syncLeaseUntil,
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

loadRoomsFromDisk();

process.on("beforeExit", () => {
    try {
        flushDirtyRooms();
    } catch (error) {
        logError(TAG, "Failed to flush room files before exit", error);
    }
});
