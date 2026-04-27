import { Server } from "socket.io";
import { logError, logInfo, logWarn } from "../logger.js";
import { Room, RoomPlaybackSong, Song } from "../types.js";
import * as musicCacheService from "./music-cache.service.js";
import * as qqMusicService from "./qqmusic.service.js";
import * as roomService from "./room.service.js";

const TAG = "PlaybackService";

export function broadcastRoomState(room: Room, roomId: string, io: Server, persist = false): void {
    if (persist) {
        roomService.saveRooms(room.id);
    }
    io.to(roomId).emit("room_state", roomService.getSafeRoomState(room));
}

function emitPlayerSync(room: Room, roomId: string, io: Server): void {
    io.to(roomId).emit("player_sync", {
        currentTime: roomService.getEffectivePlaybackTime(room),
        isPlaying: room.isPlaying,
        syncedAt: Date.now(),
        syncLeaderId: room.syncLeaderId,
        syncLeaderName: room.syncLeaderName,
        syncTerm: room.syncTerm,
        syncVersion: room.syncVersion,
    });
}

export function appendSystemMessage(
    room: Room,
    roomId: string,
    io: Server,
    text: string,
    persist = false,
): void {
    const msg = {
        id: Date.now(),
        type: "system" as const,
        text,
    };
    room.chat.push(msg);
    if (room.chat.length > 100) room.chat.shift();
    if (persist) {
        roomService.saveRooms(room.id);
    }
    io.to(roomId).emit("chat_message", msg);
}

export function normalizeIncomingSong(song: any, requestedBy: string): Song {
    const albummid = song.albummid || (song.album && song.album.mid) || song.album_mid || "";
    return {
        ...song,
        id: song.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        songmid: song.songmid || song.mid || "",
        songname: song.songname || song.name || song.title || "",
        singer: roomService.formatSinger(song.singer || song.singer_name || song.artist_name),
        albumname: song.albumname || song.album?.title || song.album?.name || "Unknown Album",
        albummid,
        requestedBy,
    };
}

function createLocalCachedSong(track: any): RoomPlaybackSong {
    return {
        id: track.songmid,
        songmid: track.songmid,
        songname: track.songname,
        singer: track.singer || "Unknown Artist",
        albumname: track.albumname || "Local Cache",
        albummid: track.albummid || "",
        requestedBy: "LocalCache",
        playUrl: track.audioUrl,
        playQuality: "local-cache",
    };
}

export async function setCurrentSongPlaybackInfo(
    room: Room,
    roomId: string,
    io: Server,
    songmid: string,
    playableUrl: string,
    quality: string | number | null,
): Promise<boolean> {
    if (!room.currentSong || room.currentSong.songmid !== songmid || !playableUrl) {
        return false;
    }

    const nextQuality = quality ?? undefined;
    const changed = room.currentSong.playUrl !== playableUrl || room.currentSong.playQuality !== nextQuality;
    if (!changed) {
        return false;
    }

    room.currentSong.playUrl = playableUrl;
    room.currentSong.playQuality = nextQuality;
    broadcastRoomState(room, roomId, io, true);

    logInfo(TAG, "Updated current song playback info", {
        roomId,
        songmid,
        quality: nextQuality ?? null,
    });

    return true;
}

export async function warmCurrentSongPlayback(room: Room, roomId: string, io: Server): Promise<void> {
    const currentSong = room.currentSong;
    const hostCookie = room.hostCookie;

    if (!currentSong?.songmid || currentSong.playUrl) {
        return;
    }

    try {
        const { playableUrl, quality } = await qqMusicService.resolveSongPlayback(currentSong.songmid, hostCookie);
        const changed = await setCurrentSongPlaybackInfo(room, roomId, io, currentSong.songmid, playableUrl, quality);
        if (changed) {
            logInfo(TAG, "Warmed current song playback URL", {
                roomId,
                songmid: currentSong.songmid,
                quality: quality ?? null,
            });
        }
    } catch (error) {
        logWarn(TAG, "Failed to warm current song playback URL", {
            roomId,
            songmid: currentSong.songmid,
            message: error instanceof Error ? error.message : String(error),
        });
        appendSystemMessage(room, roomId, io, `System: Failed to resolve playback for ${currentSong.songname}, skipping...`, true);
        void skipCurrentSong(room, roomId, io, "System", true);
    }
}

export async function warmNextSongPlayback(room: Room, roomId: string, io: Server): Promise<void> {
    const nextSong = room.queue[0];
    const hostCookie = room.hostCookie;

    if (!nextSong?.songmid || nextSong.playUrl) {
        return;
    }

    try {
        const { playableUrl, quality } = await qqMusicService.resolveSongPlayback(nextSong.songmid, hostCookie);
        // Check if the song is still at the front of the queue
        if (room.queue[0] && nextSong.songmid === room.queue[0].songmid) {
            room.queue[0].playUrl = playableUrl;
            room.queue[0].playQuality = quality ?? undefined;
            broadcastRoomState(room, roomId, io, true);
            logInfo(TAG, "Warmed next song playback URL", {
                roomId,
                songmid: nextSong.songmid,
                quality: quality ?? null,
            });
        }
    } catch (error) {
        logWarn(TAG, "Failed to warm next song playback URL", {
            roomId,
            songmid: nextSong.songmid,
            message: error instanceof Error ? error.message : String(error),
        });
    }
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
        const normalized = normalizeIncomingSong(nextSong, "Radio");
        if (!normalized.songmid || !normalized.songname) {
            logWarn(TAG, "Invalid radio track payload for auto play", {
                roomId: room.id,
                trackKeys: nextSong ? Object.keys(nextSong) : [],
            });
            return null;
        }
        return normalized;
    } catch (error) {
        logError(TAG, "Failed to fetch recommended song", error, { roomId: room.id });
        return null;
    }
}

function fetchRandomLocalCachedSong(): RoomPlaybackSong | null {
    const track = musicCacheService.getRandomCachedTrack();
    if (!track?.songmid || !track?.audioUrl) {
        return null;
    }

    return createLocalCachedSong(track);
}

export async function playNextSong(room: Room, roomId: string, io: Server, isAuto = false): Promise<void> {
    if (room.queue.length > 0) {
        room.currentSong = room.queue.shift()!;
        room.currentSong.playUrl = undefined;
        room.currentSong.playQuality = undefined;
        roomService.setPlaybackClock(room, 0, true);
        roomService.bumpSyncVersion(room);

        logInfo(TAG, "Play next song from queue", {
            roomId,
            songName: room.currentSong.songname,
            singer: room.currentSong.singer,
            requestedBy: room.currentSong.requestedBy,
            remainingQueue: room.queue.length,
            isAuto,
        });

        broadcastRoomState(room, roomId, io, true);
        void warmCurrentSongPlayback(room, roomId, io).then(() => {
            void warmNextSongPlayback(room, roomId, io);
        });

        if (!isAuto) {
            appendSystemMessage(
                room,
                roomId,
                io,
                `Now playing: ${room.currentSong.songname} - ${room.currentSong.singer}`,
            );
        }
        return;
    }

    if (room.hostCookie) {
        const autoSong = await fetchRecommendedSong(room);
        if (autoSong) {
            room.currentSong = autoSong;
            roomService.setPlaybackClock(room, 0, true);
            roomService.bumpSyncVersion(room);

            logInfo(TAG, "Auto recommendation started", {
                roomId,
                songName: autoSong.songname,
                singer: autoSong.singer,
            });

            broadcastRoomState(room, roomId, io, true);
            void warmCurrentSongPlayback(room, roomId, io).then(() => {
                void warmNextSongPlayback(room, roomId, io);
            });
            return;
        }
    }

    const localSong = fetchRandomLocalCachedSong();
    if (localSong) {
        room.currentSong = localSong;
        roomService.setPlaybackClock(room, 0, true);
        roomService.bumpSyncVersion(room);

        logInfo(TAG, "Local cached random playback started", {
            roomId,
            songName: localSong.songname,
            singer: localSong.singer,
        });

        broadcastRoomState(room, roomId, io, true);
        return;
    }

    room.currentSong = null;
    roomService.setPlaybackClock(room, 0, false);
    roomService.bumpSyncVersion(room);
    roomService.saveRooms(room.id);
    logInfo(TAG, "Queue ended", { roomId });
    io.to(roomId).emit("room_state", roomService.getSafeRoomState(room));
}

export async function queueSong(room: Room, roomId: string, io: Server, song: any, requestedBy: string): Promise<void> {
    const newSong = normalizeIncomingSong(song, requestedBy);
    room.queue.push(newSong);

    logInfo(TAG, "Song added", {
        roomId,
        userName: requestedBy,
        songName: newSong.songname,
        singer: newSong.singer,
        queueLength: room.queue.length,
    });

    if (!room.currentSong) {
        await playNextSong(room, roomId, io);
        return;
    }

    void warmNextSongPlayback(room, roomId, io);
    appendSystemMessage(room, roomId, io, `${requestedBy} queued: ${newSong.songname}`, true);
    io.to(roomId).emit("room_state", roomService.getSafeRoomState(room));
}

export async function skipCurrentSong(
    room: Room,
    roomId: string,
    io: Server,
    requestedBy: string,
    isAuto = false,
): Promise<boolean> {
    if (isAuto && room.lastSkipTime && Date.now() - room.lastSkipTime < 1500) {
        logInfo(TAG, "Ignore duplicated auto skip", {
            roomId,
            userName: requestedBy,
            lastSkipAgeMs: Date.now() - room.lastSkipTime,
        });
        return false;
    }

    const skippedSongName = room.currentSong?.songname;
    logInfo(TAG, "Skip song", {
        roomId,
        userName: requestedBy,
        skippedSong: skippedSongName ?? "none",
        isAuto,
    });

    room.lastSkipTime = Date.now();
    roomService.bumpSyncVersion(room);
    await playNextSong(room, roomId, io, isAuto);

    if (skippedSongName && !isAuto) {
        appendSystemMessage(room, roomId, io, `${requestedBy} skipped a song`);
    }

    return true;
}

export function applyPlaybackControl(
    room: Room,
    roomId: string,
    io: Server,
    requestedBy: string,
    socketId: string,
    currentTime: number,
    isPlaying: boolean,
): void {
    if (!room.currentSong) return;

    roomService.assignSyncLeader(room, { id: socketId, name: requestedBy });
    const wasPlaying = room.isPlaying;
    roomService.setPlaybackClock(room, currentTime, isPlaying);
    roomService.bumpSyncVersion(room);
    roomService.renewSyncLeaderLease(room);
    roomService.saveRooms(room.id);
    emitPlayerSync(room, roomId, io);

    const isRecentlySkipped = room.lastSkipTime && Date.now() - room.lastSkipTime < 3000;
    if (wasPlaying !== room.isPlaying && !isRecentlySkipped) {
        appendSystemMessage(
            room,
            roomId,
            io,
            room.isPlaying ? `${requestedBy} resumed playback` : `${requestedBy} paused playback`,
        );
    }
}

export function applyPlaybackSeek(
    room: Room,
    roomId: string,
    io: Server,
    requestedBy: string,
    socketId: string,
    currentTime: number,
): void {
    if (!room.currentSong) return;

    roomService.assignSyncLeader(room, { id: socketId, name: requestedBy });
    roomService.setPlaybackClock(room, currentTime, room.isPlaying);
    roomService.bumpSyncVersion(room);
    roomService.renewSyncLeaderLease(room);
    roomService.saveRooms(room.id);
    emitPlayerSync(room, roomId, io);
}

export async function startBatchPlayback(
    room: Room,
    roomId: string,
    io: Server,
    songs: any[],
    requestedBy: string,
): Promise<void> {
    if (!Array.isArray(songs) || songs.length === 0) {
        return;
    }

    room.queue = songs.map((song) => normalizeIncomingSong(song, requestedBy));
    room.lastSkipTime = Date.now();
    roomService.bumpSyncVersion(room);
    await playNextSong(room, roomId, io);
    appendSystemMessage(room, roomId, io, `${requestedBy} started batch playback (${room.queue.length + (room.currentSong ? 1 : 0)} songs)`, true);
}

export function cacheCurrentSong(room: Room, roomId: string | string[] | undefined, playableUrl: string): void {
    if (!playableUrl || !room.currentSong) {
        return;
    }

    musicCacheService.cachePlayedSong(room.currentSong, playableUrl).catch((error) => {
        logError(TAG, "Failed to cache currently playing song", error, {
            roomId,
            songmid: room.currentSong?.songmid,
        });
    });
}
