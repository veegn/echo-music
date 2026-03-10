import { Server, Socket } from "socket.io";
import * as roomService from "../services/room.service.js";
import { logInfo, logWarn } from "../logger.js";

const TAG = "SocketHandler";

export function registerSocketHandlers(io: Server): void {
    io.on("connection", (socket: Socket) => {
        logInfo(TAG, "New socket connected", { socketId: socket.id });

        socket.on("join_room", ({ roomId, userName, password }) => {
            const room = roomService.getRoom(roomId);
            if (!room) {
                logWarn(TAG, "Join failed: room not found", { roomId, userName });
                return socket.emit("error", "Room not found");
            }
            if (room.password && room.password !== password) {
                logWarn(TAG, "Join failed: wrong password", { roomId, userName });
                return socket.emit("error", "Incorrect password");
            }

            room.users = room.users.filter((u) => u.id !== socket.id);
            room.users.push({ id: socket.id, name: userName });
            socket.join(roomId);
            roomService.cancelRoomDestruction(roomId);

            logInfo(TAG, "User joined room", {
                roomId,
                userName,
                socketId: socket.id,
                currentUsers: room.users.length,
            });

            io.to(roomId).emit("room_state", roomService.getSafeRoomState(room));

            const joinMsg = {
                id: Date.now(),
                type: "system" as const,
                text: `${userName} joined the room`,
            };
            room.chat.push(joinMsg);
            if (room.chat.length > 100) room.chat.shift();
            roomService.saveRooms();
            io.to(roomId).emit("chat_message", joinMsg);

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

            socket.on("disconnect", () => {
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

            socket.on("chat_message", (text: string) => {
                const msg = { id: Date.now(), type: "user" as const, userName, text };
                room.chat.push(msg);
                if (room.chat.length > 100) room.chat.shift();
                roomService.saveRooms();
                io.to(roomId).emit("chat_message", msg);
            });

            socket.on("add_song", (song: any) => {
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

            socket.on("skip_song", (isAuto?: boolean) => {
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

            socket.on("reorder_queue", ({ oldIndex, newIndex }) => {
                if (oldIndex < 0 || oldIndex >= room.queue.length || newIndex < 0 || newIndex >= room.queue.length) return;
                const [item] = room.queue.splice(oldIndex, 1);
                room.queue.splice(newIndex, 0, item);
                roomService.saveRooms();
                logInfo(TAG, "Queue reordered", { roomId, userName, oldIndex, newIndex, songName: item.songname });
                io.to(roomId).emit("room_state", roomService.getSafeRoomState(room));
            });

            socket.on("remove_song", (index: number) => {
                if (index >= 0 && index < room.queue.length) {
                    const removed = room.queue.splice(index, 1)[0];
                    roomService.saveRooms();
                    logInfo(TAG, "Song removed", { roomId, userName, songName: removed.songname });
                    io.to(roomId).emit("room_state", roomService.getSafeRoomState(room));
                }
            });

            socket.on("set_cookie", (cookie: string) => {
                if (userName !== room.hostName) {
                    logWarn(TAG, "Only host can update cookie", { roomId, userName, socketId: socket.id });
                    return socket.emit("error", "Only the host can update room cookie");
                }

                roomService.setRoomCookie(room, cookie);
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
            });

            socket.on("sync_player", ({ currentTime, isPlaying }) => {
                const wasPlaying = room.isPlaying;
                room.currentTime = currentTime;
                room.isPlaying = isPlaying;
                io.to(roomId).emit("player_sync", { currentTime, isPlaying });

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

            socket.on("play_songs", (songs: any[]) => {
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

            socket.on("clear_queue", () => {
                room.queue = [];
                logInfo(TAG, "Queue cleared", { roomId, userName });
                io.to(roomId).emit("room_state", roomService.getSafeRoomState(room));
                roomService.saveRooms();
            });
        });
    });
}
