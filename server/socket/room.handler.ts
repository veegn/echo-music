import { Server, Socket } from "socket.io";
import * as playbackService from "../services/playback.service.js";
import * as roomService from "../services/room.service.js";
import { logInfo, logWarn, logDebug } from "../logger.js";
import { config } from "../config.js";
import type { Room } from "../types.js";

const TAG = "SocketHandler";

function emitUsersChanged(io: Server, roomId: string, room: Room): void {
    io.to(roomId).emit("users_changed", {
        users: room.users,
        syncLeaderId: room.syncLeaderId,
        syncLeaderName: room.syncLeaderName,
        syncTerm: room.syncTerm,
        syncVersion: room.syncVersion,
        syncLeaseUntil: room.syncLeaseUntil,
    });
}

export function registerSocketHandlers(io: Server): void {
    io.on("connection", (socket: Socket) => {
        logInfo(TAG, "New socket connected", { socketId: socket.id });

        socket.on("join_room", ({ roomId, userName, password }) => {
            // ─── 初始校验 ───────────────────────────────────────────────
            const initialRoom = roomService.getRoom(roomId);
            if (!initialRoom) {
                logWarn(TAG, "Join failed: room not found", { roomId, userName });
                return socket.emit("error", "Room not found");
            }
            if (initialRoom.password && initialRoom.password !== password) {
                logWarn(TAG, "Join failed: wrong password", { roomId, userName });
                return socket.emit("error", "Incorrect password");
            }

            // ─── 修复②：每次事件触发时重新从 Map 获取 room 引用 ─────────
            // 避免闭包长期持有可能已过期/被删除的旧 room 对象
            const getRoom = () => roomService.getRoom(roomId);

            // 加入 socket room 并更新用户列表
            {
                const room = getRoom()!;
                room.users = room.users.filter((u) => u.id !== socket.id);
                room.users.push({ id: socket.id, name: userName });
                roomService.ensureSyncLeader(room);
            }
            socket.join(roomId);

            logInfo(TAG, "User joined room", {
                roomId,
                userName,
                socketId: socket.id,
                currentUsers: getRoom()?.users.length,
            });

            {
                const room = getRoom()!;
                socket.emit("room_state", roomService.getSafeRoomState(room));
                socket.to(roomId).emit("users_changed", {
                    users: room.users,
                    syncLeaderId: room.syncLeaderId,
                    syncLeaderName: room.syncLeaderName,
                    syncTerm: room.syncTerm,
                    syncVersion: room.syncVersion,
                    syncLeaseUntil: room.syncLeaseUntil,
                });
            }

            {
                const room = getRoom()!;
                playbackService.appendSystemMessage(room, roomId, io, `${userName} joined the room`, true);
            }

            // 重置监听器防止重复绑定（重连场景）
            socket.removeAllListeners("disconnect");
            socket.removeAllListeners("chat_message");
            socket.removeAllListeners("add_song");
            socket.removeAllListeners("skip_song");
            socket.removeAllListeners("reorder_queue");
            socket.removeAllListeners("remove_song");
            socket.removeAllListeners("set_cookie");
            socket.removeAllListeners("sync_player");
            socket.removeAllListeners("control_playback");
            socket.removeAllListeners("seek_player");
            socket.removeAllListeners("play_songs");
            socket.removeAllListeners("clear_queue");
            socket.removeAllListeners("delete_room");

            // ─── disconnect ──────────────────────────────────────────────
            socket.on("disconnect", () => {
                const room = getRoom();
                if (!room) return;

                roomService.refreshPlaybackClock(room);
                room.users = room.users.filter((u) => u.id !== socket.id);
                if (room.syncLeaderId === socket.id) {
                    roomService.assignSyncLeader(
                        room,
                        room.users.find((user) => user.name === room.hostName) || room.users[0] || null,
                    );
                } else {
                    roomService.ensureSyncLeader(room);
                }
                logInfo(TAG, "User left room", {
                    roomId,
                    userName,
                    socketId: socket.id,
                    remainingUsers: room.users.length,
                    syncLeaderId: room.syncLeaderId || "(none)",
                });

                emitUsersChanged(io, roomId, room);
                playbackService.appendSystemMessage(room, roomId, io, `${userName} left the room`, true);

            });

            // ─── chat_message ────────────────────────────────────────────
            socket.on("chat_message", (text: string) => {
                const room = getRoom();
                if (!room) return;

                const msg = { id: Date.now(), type: "user" as const, userName, text };
                room.chat.push(msg);
                if (room.chat.length > config.room.maxChatHistory) {
                    room.chat.shift();
                }
                io.to(roomId).emit("chat_message", msg);
            });

            // ─── add_song ────────────────────────────────────────────────
            socket.on("add_song", (song: any) => {
                const room = getRoom();
                if (!room) return;
                void playbackService.queueSong(room, roomId, io, song, userName);
            });

            // ─── skip_song ───────────────────────────────────────────────
            socket.on("skip_song", (isAuto?: boolean) => {
                const room = getRoom();
                if (!room) return;
                void playbackService.skipCurrentSong(room, roomId, io, userName, !!isAuto);
            });

            // ─── reorder_queue ───────────────────────────────────────────
            socket.on("reorder_queue", ({ oldIndex, newIndex }) => {
                const room = getRoom();
                if (!room) return;
                if (oldIndex < 0 || oldIndex >= room.queue.length || newIndex < 0 || newIndex >= room.queue.length) return;

                const [item] = room.queue.splice(oldIndex, 1);
                room.queue.splice(newIndex, 0, item);
                roomService.saveRooms(roomId);
                logDebug(TAG, "Queue reordered", { roomId, userName, oldIndex, newIndex, songName: item.songname });
                io.to(roomId).emit("room_state", roomService.getSafeRoomState(room));
            });

            // ─── remove_song ─────────────────────────────────────────────
            socket.on("remove_song", (index: number) => {
                const room = getRoom();
                if (!room) return;
                if (index >= 0 && index < room.queue.length) {
                    const removed = room.queue.splice(index, 1)[0];
                    roomService.saveRooms(roomId);
                    logDebug(TAG, "Song removed", { roomId, userName, songName: removed.songname });
                    io.to(roomId).emit("room_state", roomService.getSafeRoomState(room));
                }
            });

            // ─── set_cookie ──────────────────────────────────────────────
            socket.on("set_cookie", async (cookie: string, ack?: (response: { success: boolean; error?: string }) => void) => {
                const room = getRoom();
                if (!room) {
                    ack?.({ success: false, error: "Room not found" });
                    return;
                }

                logInfo(TAG, "Received set_cookie event", { roomId, userName, cookieLength: cookie?.length || 0 });
                if (userName !== room.hostName) {
                    logWarn(TAG, "Only host can update cookie", { roomId, userName, hostName: room.hostName, socketId: socket.id });
                    const error = "Only the host can update room cookie";
                    ack?.({ success: false, error });
                    return socket.emit("error", error);
                }

                if (cookie) {
                    const verification = await roomService.verifyRoomCookie(cookie);
                    if (!verification.success) {
                        logWarn(TAG, "Rejected invalid cookie update", { roomId, userName, reason: verification.message });
                        const error = verification.message || "Invalid QQMusic cookie";
                        ack?.({ success: false, error });
                        return socket.emit("error", error);
                    }
                }

                roomService.setRoomCookie(room, cookie);
                logInfo(TAG, "Room cookie updated from socket", { roomId, hasCookie: !!room.hostCookie, qqId: room.hostQQId });
                const qqIdDisplay = room.hostQQId ? ` (QQ: ${room.hostQQId})` : "";
                io.to(roomId).emit("chat_message", {
                    id: Date.now(),
                    type: "system",
                    text: cookie
                        ? `Host updated QQMusic VIP cookie${qqIdDisplay}`
                        : "Host cleared QQMusic VIP cookie",
                });

                if (!room.currentSong && room.queue.length === 0) {
                    void playbackService.playNextSong(room, roomId, io);
                } else {
                    playbackService.broadcastRoomState(room, roomId, io);
                }

                ack?.({ success: true });
            });

            // ─── sync_player ─────────────────────────────────────────────
            socket.on("sync_player", ({ currentTime, isPlaying, term, version }) => {
                const room = getRoom();
                if (!room) return;

                const leaderExpired = !roomService.isSyncLeaderActive(room);
                if (!room.syncLeaderId || leaderExpired) {
                    const changed = roomService.assignSyncLeader(room, { id: socket.id, name: userName });
                    if (changed) {
                        logInfo(TAG, "Sync leader reassigned", {
                            roomId,
                            userName,
                            socketId: socket.id,
                            syncLeaderId: room.syncLeaderId,
                            syncTerm: room.syncTerm,
                            reason: leaderExpired ? "expired" : "missing",
                        });
                        emitUsersChanged(io, roomId, room);
                    }
                }

                if (room.syncLeaderId !== socket.id) return;
                if (typeof term === "number" && term !== room.syncTerm) return;
                if (typeof version === "number" && version !== room.syncVersion) return;

                // 仅允许房主同步播放状态，防止非房主伪造进度
                const wasPlaying = room.isPlaying;
                roomService.setPlaybackClock(room, currentTime, isPlaying);
                roomService.renewSyncLeaderLease(room);

                if (wasPlaying !== isPlaying) {
                    roomService.bumpSyncVersion(room);
                }

                // ✅ 修复④：附加服务端时间戳，客户端可据此补偿网络延迟
                io.to(roomId).emit("player_sync", {
                    currentTime: roomService.getEffectivePlaybackTime(room),
                    isPlaying,
                    syncedAt: Date.now(),
                    syncLeaderId: room.syncLeaderId,
                    syncLeaderName: room.syncLeaderName,
                    syncTerm: room.syncTerm,
                    syncVersion: room.syncVersion,
                });

                const isRecentlySkipped = room.lastSkipTime && Date.now() - room.lastSkipTime < 3000;
                if (wasPlaying !== isPlaying && !isRecentlySkipped) {
                    playbackService.appendSystemMessage(
                        room,
                        roomId,
                        io,
                        isPlaying ? `${userName} resumed playback` : `${userName} paused playback`,
                        true,
                    );
                }
            });

            socket.on("control_playback", ({ currentTime, isPlaying, version }) => {
                const room = getRoom();
                if (!room || !room.currentSong) return;
                if (typeof version === "number" && version < room.syncVersion) return;

                playbackService.applyPlaybackControl(
                    room,
                    roomId,
                    io,
                    userName,
                    socket.id,
                    currentTime,
                    isPlaying,
                );
            });

            socket.on("seek_player", ({ currentTime, version }) => {
                const room = getRoom();
                if (!room || !room.currentSong) return;
                if (typeof version === "number" && version < room.syncVersion) return;

                playbackService.applyPlaybackSeek(
                    room,
                    roomId,
                    io,
                    userName,
                    socket.id,
                    currentTime,
                );
            });

            // ─── play_songs ──────────────────────────────────────────────
            socket.on("play_songs", (songs: any[]) => {
                const room = getRoom();
                if (!room) return;
                void playbackService.startBatchPlayback(room, roomId, io, songs, userName);
            });

            // ─── clear_queue ─────────────────────────────────────────────
            socket.on("clear_queue", () => {
                const room = getRoom();
                if (!room) return;
                room.queue = [];
                roomService.saveRooms(roomId);
                logDebug(TAG, "Queue cleared", { roomId, userName });
                playbackService.broadcastRoomState(room, roomId, io, true);
            });

            socket.on("delete_room", (ack?: (response: { success: boolean; error?: string }) => void) => {
                const room = getRoom();
                if (!room) {
                    ack?.({ success: false, error: "Room not found" });
                    return;
                }

                if (userName !== room.hostName) {
                    ack?.({ success: false, error: "Only the host can delete the room" });
                    return;
                }

                logInfo(TAG, "Room deleted by host", {
                    roomId,
                    hostName: userName,
                    socketId: socket.id,
                });

                io.to(roomId).emit("room_deleted", {
                    roomId,
                    message: `${userName} deleted the room`,
                    deletedBySocketId: socket.id,
                });
                roomService.deleteRoom(roomId);
                ack?.({ success: true });
            });
        });
    });
}
