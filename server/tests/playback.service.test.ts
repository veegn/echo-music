import test from "node:test";
import assert from "node:assert/strict";
import { applyPlaybackControl, applyPlaybackSeek, appendSystemMessage, normalizeIncomingSong, setCurrentSongPlaybackInfo } from "../services/playback.service.js";
import type { Room } from "../types.js";

function createMockIo() {
    const events: Array<{ roomId: string; event: string; payload: any }> = [];
    return {
        events,
        io: {
            to(roomId: string) {
                return {
                    emit(event: string, payload: any) {
                        events.push({ roomId, event, payload });
                    },
                };
            },
        } as any,
    };
}

function createRoom(overrides: Partial<Room> = {}): Room {
    return {
        id: "room-1",
        name: "Room",
        password: "",
        hostName: "Host",
        hostCookie: null,
        hostQQId: "",
        users: [{ id: "socket-host", name: "Host" }],
        queue: [],
        currentSong: {
            id: "song-1",
            songmid: "mid-1",
            songname: "Song",
            singer: "Singer",
            albumname: "Album",
            albummid: "album-mid",
            requestedBy: "Host",
        },
        isPlaying: false,
        currentTime: 0,
        playbackUpdatedAt: 0,
        syncLeaderId: "",
        syncLeaderName: "",
        syncTerm: 0,
        syncVersion: 0,
        syncLeaseUntil: 0,
        chat: [],
        ...overrides,
    };
}

test("normalizeIncomingSong normalizes common upstream fields", () => {
    const song = normalizeIncomingSong({
        mid: "003",
        title: "Track",
        singer: [{ name: "Singer A" }, { name: "Singer B" }],
        album: { mid: "album-1", title: "Album" },
    }, "Tester");

    assert.equal(song.songmid, "003");
    assert.equal(song.songname, "Track");
    assert.equal(song.singer, "Singer A / Singer B");
    assert.equal(song.albumname, "Album");
    assert.equal(song.albummid, "album-1");
    assert.equal(song.requestedBy, "Tester");
});

test("setCurrentSongPlaybackInfo updates current song and broadcasts room state", async () => {
    const room = createRoom();
    const { io, events } = createMockIo();

    const changed = await setCurrentSongPlaybackInfo(room, room.id, io, "mid-1", "https://example.com/song.mp3", "320");

    assert.equal(changed, true);
    assert.equal(room.currentSong?.playUrl, "https://example.com/song.mp3");
    assert.equal(room.currentSong?.playQuality, "320");
    assert.equal(events.length, 1);
    assert.equal(events[0].event, "room_state");
    assert.equal(events[0].payload.currentSong.playUrl, "https://example.com/song.mp3");
});

test("setCurrentSongPlaybackInfo ignores stale song updates", async () => {
    const room = createRoom();
    const { io, events } = createMockIo();

    const changed = await setCurrentSongPlaybackInfo(room, room.id, io, "other-mid", "https://example.com/song.mp3", "320");

    assert.equal(changed, false);
    assert.equal(room.currentSong?.playUrl, undefined);
    assert.equal(events.length, 0);
});

test("appendSystemMessage appends bounded chat message and emits", () => {
    const room = createRoom({
        chat: Array.from({ length: 100 }, (_, index) => ({
            id: index,
            type: "system" as const,
            text: `msg-${index}`,
        })),
    });
    const { io, events } = createMockIo();

    appendSystemMessage(room, room.id, io, "new-message");

    assert.equal(room.chat.length, 100);
    assert.equal(room.chat.at(-1)?.text, "new-message");
    assert.equal(events.length, 1);
    assert.equal(events[0].event, "chat_message");
});

test("applyPlaybackControl promotes leader, updates playback and emits sync", () => {
    const room = createRoom();
    const { io, events } = createMockIo();

    applyPlaybackControl(room, room.id, io, "Guest", "socket-guest", 42, true);

    assert.equal(room.currentTime, 42);
    assert.equal(room.isPlaying, true);
    assert.equal(room.syncLeaderId, "socket-guest");
    assert.equal(room.syncLeaderName, "Guest");
    assert.ok(room.syncVersion > 0);
    assert.ok(!events.some((event) => event.event === "room_state"));
    assert.ok(events.some((event) => event.event === "player_sync"));
});

test("applyPlaybackSeek updates position and emits sync without changing play state", () => {
    const room = createRoom({ isPlaying: true, currentTime: 10 });
    const { io, events } = createMockIo();

    applyPlaybackSeek(room, room.id, io, "Guest", "socket-guest", 88);

    assert.equal(room.currentTime, 88);
    assert.equal(room.isPlaying, true);
    assert.ok(!events.some((event) => event.event === "room_state"));
    const syncEvent = events.find((event) => event.event === "player_sync");
    assert.ok(syncEvent);
    assert.ok(syncEvent.payload.currentTime >= 88);
});
