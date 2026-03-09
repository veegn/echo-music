// ============================
// Socket.io 房间事件处理器
// ============================

import { Server, Socket } from "socket.io";
import * as roomService from "../services/room.service.js";
import { logInfo, logWarn, logError } from "../logger.js";

const TAG = "SocketHandler";

export function registerSocketHandlers(io: Server): void {
    io.on("connection", (socket: Socket) => {
        logInfo(TAG, "新 Socket 连接", { socketId: socket.id });

        socket.on("join_room", ({ roomId, userName, password }) => {
            const room = roomService.getRoom(roomId);
            if (!room) {
                logWarn(TAG, "加入房间失败：房间不存在", { roomId, userName });
                return socket.emit("error", "Room not found");
            }
            if (room.password && room.password !== password) {
                logWarn(TAG, "加入房间失败：密码错误", { roomId, userName });
                return socket.emit("error", "Incorrect password");
            }

            // 添加用户到房间
            const user = { id: socket.id, name: userName };
            room.users.push(user);
            socket.join(roomId);

            logInfo(TAG, "用户加入房间", {
                roomId,
                userName,
                socketId: socket.id,
                currentUsers: room.users.length,
            });

            io.to(roomId).emit("room_state", roomService.getSafeRoomState(room));
            io.to(roomId).emit("chat_message", {
                id: Date.now(), type: "system",
                text: `${userName} 加入了房间`,
            });

            // ----- 注册该连接下的事件 -----

            socket.on("disconnect", () => {
                room.users = room.users.filter(u => u.id !== socket.id);
                logInfo(TAG, "用户离开房间", {
                    roomId,
                    userName,
                    socketId: socket.id,
                    remainingUsers: room.users.length,
                });

                io.to(roomId).emit("room_state", roomService.getSafeRoomState(room));
                io.to(roomId).emit("chat_message", {
                    id: Date.now(), type: "system",
                    text: `${userName} 离开了房间`,
                });

                // 空房自动清理
                if (room.users.length === 0) {
                    roomService.deleteRoom(roomId);
                }
            });

            socket.on("chat_message", (text: string) => {
                const msg = { id: Date.now(), type: "user" as const, userName, text };
                room.chat.push(msg);
                if (room.chat.length > 100) room.chat.shift();
                io.to(roomId).emit("chat_message", msg);
            });

            socket.on("add_song", (song: any) => {
                const singerName = roomService.formatSinger(song.singer);
                const newSong = {
                    ...song,
                    singer: singerName,
                    requestedBy: userName,
                    id: Date.now().toString(),
                };
                room.queue.push(newSong);
                logInfo(TAG, "用户点歌", {
                    roomId,
                    userName,
                    songName: song.songname,
                    singer: singerName,
                    queueLength: room.queue.length,
                });

                if (!room.currentSong) {
                    roomService.playNextSong(room, roomId, io);
                } else {
                    io.to(roomId).emit("room_state", roomService.getSafeRoomState(room));
                }
            });

            socket.on("skip_song", () => {
                logInfo(TAG, "跳过歌曲", {
                    roomId,
                    userName,
                    skippedSong: room.currentSong?.songname ?? "无",
                });
                roomService.playNextSong(room, roomId, io);
            });

            socket.on("reorder_queue", ({ oldIndex, newIndex }) => {
                if (oldIndex < 0 || oldIndex >= room.queue.length || newIndex < 0 || newIndex >= room.queue.length) return;
                const [item] = room.queue.splice(oldIndex, 1);
                room.queue.splice(newIndex, 0, item);
                logInfo(TAG, "队列重排序", { roomId, userName, oldIndex, newIndex, songName: item.songname });
                io.to(roomId).emit("room_state", roomService.getSafeRoomState(room));
            });

            socket.on("remove_song", (index: number) => {
                if (index >= 0 && index < room.queue.length) {
                    const removed = room.queue.splice(index, 1)[0];
                    logInfo(TAG, "移除歌曲", { roomId, userName, songName: removed.songname });
                    io.to(roomId).emit("room_state", roomService.getSafeRoomState(room));
                }
            });

            socket.on("set_cookie", (cookie: string) => {
                roomService.setRoomCookie(room, cookie);
                const qqIdDisplay = room.hostQQId ? ` (QQ: ${room.hostQQId})` : '';
                io.to(roomId).emit("chat_message", {
                    id: Date.now(), type: "system",
                    text: cookie
                        ? `房主更新了 QQ 音乐 VIP Cookie${qqIdDisplay}`
                        : `房主清除了 QQ 音乐 VIP Cookie`,
                });

                if (!room.currentSong && room.queue.length === 0) {
                    roomService.playNextSong(room, roomId, io);
                } else {
                    io.to(roomId).emit("room_state", roomService.getSafeRoomState(room));
                }
            });

            socket.on("sync_player", ({ currentTime, isPlaying }) => {
                room.currentTime = currentTime;
                room.isPlaying = isPlaying;
                io.to(roomId).emit("player_sync", { currentTime, isPlaying });
            });
        });
    });
}
