import { Server, Socket } from "socket.io";
import * as roomService from "../services/room.service.js";
import { logInfo, logWarn } from "../logger.js";

const TAG = "SocketHandler";

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
            }
            socket.join(roomId);
            roomService.cancelRoomDestruction(roomId);

            logInfo(TAG, "User joined room", {
                roomId,
                userName,
                socketId: socket.id,
                currentUsers: getRoom()?.users.length,
            });

            io.to(roomId).emit("room_state", roomService.getSafeRoomState(getRoom()!));

            const joinMsg = {
                id: Date.now(),
                type: "system" as const,
                text: `${userName} joined the room`,
            };
            {
                const room = getRoom()!;
                room.chat.push(joinMsg);
                if (room.chat.length > 100) room.chat.shift();
            }
            roomService.saveRooms();
            io.to(roomId).emit("chat_message", joinMsg);

            // 重置监听器防止重复绑定（重连场景）
            socket.removeAllListeners("disconnect");
            socket.removeAllListeners("chat_message");
            socket.removeAllListeners("add_song");
            socket.removeAllListeners("skip_song");
            socket.removeAllListeners("reorder_queue");
            socket.removeAllListeners("remove_song");
            socket.removeAllListeners("set_cookie");
            socket.removeAllListeners("sync_player");
            socket.removeAllListeners("play_songs");
            socket.removeAllListeners("clear_queue");

            // ─── disconnect ──────────────────────────────────────────────
            socket.on("disconnect", () => {
                const room = getRoom();
                if (!room) return;

                room.users = room.users.filter((u) => u.id !== socket.id);
                logInfo(TAG, "User left room", {
                    roomId,
                    userName,
                    socketId: socket.id,
                    remainingUsers: room.users.length,
                });

                io.to(roomId).emit("room_state", roomService.getSafeRoomState(room));
                const leaveMsg = {
                    id: Date.now(),
                    type: "system" as const,
                    text: `${userName} left the room`,
                };
                room.chat.push(leaveMsg);
                if (room.chat.length > 100) room.chat.shift();
                roomService.saveRooms();
                io.to(roomId).emit("chat_message", leaveMsg);

                if (room.users.length === 0) {
                    roomService.scheduleRoomDestruction(roomId);
                }
            });

            // ─── chat_message ────────────────────────────────────────────
            socket.on("chat_message", (text: string) => {
                const room = getRoom();
                if (!room) return;

                const msg = { id: Date.now(), type: "user" as const, userName, text };
                room.chat.push(msg);
                if (room.chat.length > 100) room.chat.shift();
                roomService.saveRooms();
                io.to(roomId).emit("chat_message", msg);
            });

            // ─── add_song ────────────────────────────────────────────────
            socket.on("add_song", (song: any) => {
                const room = getRoom();
                if (!room) return;

                const singerName = roomService.formatSinger(song.singer);
                const albummid = song.albummid || (song.album && song.album.mid) || song.album_mid || "";

                const newSong = {
                    ...song,
                    albummid,
                    singer: singerName,
                    requestedBy: userName,
                    id: Date.now().toString(),
                };

                room.queue.push(newSong);

                logInfo(TAG, "Song added", {
                    roomId,
                    userName,
                    songName: song.songname,
                    singer: singerName,
                    queueLength: room.queue.length,
                });

                if (!room.currentSong) {
                    roomService.playNextSong(room, roomId, io);
                } else {
                    const msg = {
                        id: Date.now(),
                        type: "system" as const,
                        text: `${userName} queued: ${song.songname}`,
                    };
                    room.chat.push(msg);
                    if (room.chat.length > 100) room.chat.shift();
                    roomService.saveRooms();
                    io.to(roomId).emit("room_state", roomService.getSafeRoomState(room));
                    io.to(roomId).emit("chat_message", msg);
                }
            });

            // ─── skip_song ───────────────────────────────────────────────
            socket.on("skip_song", (isAuto?: boolean) => {
                const room = getRoom();
                if (!room) return;

                const skippedSongName = room.currentSong?.songname;
                logInfo(TAG, "Skip song", {
                    roomId,
                    userName,
                    skippedSong: skippedSongName ?? "none",
                    isAuto: !!isAuto,
                });

                room.lastSkipTime = Date.now();
                roomService.playNextSong(room, roomId, io, isAuto);

                if (skippedSongName && !isAuto) {
                    const msg = { id: Date.now(), type: "system" as const, text: `${userName} skipped a song` };
                    room.chat.push(msg);
                    if (room.chat.length > 100) room.chat.shift();
                    io.to(roomId).emit("chat_message", msg);
                }
            });

            // ─── reorder_queue ───────────────────────────────────────────
            socket.on("reorder_queue", ({ oldIndex, newIndex }) => {
                const room = getRoom();
                if (!room) return;
                if (oldIndex < 0 || oldIndex >= room.queue.length || newIndex < 0 || newIndex >= room.queue.length) return;

                const [item] = room.queue.splice(oldIndex, 1);
                room.queue.splice(newIndex, 0, item);
                roomService.saveRooms();
                logInfo(TAG, "Queue reordered", { roomId, userName, oldIndex, newIndex, songName: item.songname });
                io.to(roomId).emit("room_state", roomService.getSafeRoomState(room));
            });

            // ─── remove_song ─────────────────────────────────────────────
            socket.on("remove_song", (index: number) => {
                const room = getRoom();
                if (!room) return;
                if (index >= 0 && index < room.queue.length) {
                    const removed = room.queue.splice(index, 1)[0];
                    roomService.saveRooms();
                    logInfo(TAG, "Song removed", { roomId, userName, songName: removed.songname });
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
                    roomService.playNextSong(room, roomId, io);
                } else {
                    io.to(roomId).emit("room_state", roomService.getSafeRoomState(room));
                }

                ack?.({ success: true });
            });

            // ─── sync_player ─────────────────────────────────────────────
            socket.on("sync_player", ({ currentTime, isPlaying }) => {
                const room = getRoom();
                if (!room) return;

                // 仅允许房主同步播放状态，防止非房主伪造进度
                if (userName !== room.hostName) return;

                const wasPlaying = room.isPlaying;
                room.currentTime = currentTime;
                room.isPlaying = isPlaying;

                // ✅ 修复④：附加服务端时间戳，客户端可据此补偿网络延迟
                io.to(roomId).emit("player_sync", { currentTime, isPlaying, syncedAt: Date.now() });

                const isRecentlySkipped = room.lastSkipTime && Date.now() - room.lastSkipTime < 3000;
                if (wasPlaying !== isPlaying && !isRecentlySkipped) {
                    const msg = {
                        id: Date.now(),
                        type: "system" as const,
                        text: isPlaying ? `${userName} resumed playback` : `${userName} paused playback`,
                    };
                    room.chat.push(msg);
                    if (room.chat.length > 100) room.chat.shift();
                    roomService.saveRooms();
                    io.to(roomId).emit("chat_message", msg);
                }
            });

            // ─── play_songs ──────────────────────────────────────────────
            socket.on("play_songs", (songs: any[]) => {
                const room = getRoom();
                if (!room) return;
                if (!Array.isArray(songs) || songs.length === 0) return;

                const normalizedSongs = songs.map((s) => {
                    const albummid = s.albummid || (s.album && s.album.mid) || s.album_mid || "";
                    return {
                        ...s,
                        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                        songmid: s.songmid || s.mid,
                        songname: s.songname || s.name || s.title,
                        albummid,
                        singer: roomService.formatSinger(s.singer || s.singer_name || s.artist_name),
                        requestedBy: userName,
                    };
                });

                room.queue = normalizedSongs;
                room.lastSkipTime = Date.now();
                roomService.playNextSong(room, roomId, io);

                const msg = {
                    id: Date.now(),
                    type: "system" as const,
                    text: `${userName} started batch playback (${normalizedSongs.length} songs)`,
                };
                room.chat.push(msg);
                if (room.chat.length > 100) room.chat.shift();
                roomService.saveRooms();
                io.to(roomId).emit("chat_message", msg);
            });

            // ─── clear_queue ─────────────────────────────────────────────
            socket.on("clear_queue", () => {
                const room = getRoom();
                if (!room) return;
                room.queue = [];
                logInfo(TAG, "Queue cleared", { roomId, userName });
                io.to(roomId).emit("room_state", roomService.getSafeRoomState(room));
                roomService.saveRooms();
            });
        });
    });
}
