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

            // 添加用户到房间 (移除已有的同 ID 用户防止重复)
            room.users = room.users.filter(u => u.id !== socket.id);
            const user = { id: socket.id, name: userName };
            room.users.push(user);
            socket.join(roomId);

            // 每当有用户加入，就取消房间销毁计划
            roomService.cancelRoomDestruction(roomId);

            logInfo(TAG, "用户加入房间", {
                roomId,
                userName,
                socketId: socket.id,
                currentUsers: room.users.length,
            });

            // 广播房间状态
            io.to(roomId).emit("room_state", roomService.getSafeRoomState(room));

            // 发送并持久化加入消息
            const joinMsg = {
                id: Date.now(),
                type: "system" as const,
                text: `${userName} 加入了房间`,
            };
            room.chat.push(joinMsg);
            if (room.chat.length > 100) room.chat.shift();
            roomService.saveRooms(); // 持久化加入
            io.to(roomId).emit("chat_message", joinMsg);

            // ----- 移除旧监听器防止重复注册 (如果该 socket 重新 join) -----
            socket.removeAllListeners("disconnect");
            socket.removeAllListeners("chat_message");
            socket.removeAllListeners("add_song");
            socket.removeAllListeners("skip_song");
            socket.removeAllListeners("reorder_queue");
            socket.removeAllListeners("remove_song");
            socket.removeAllListeners("set_cookie");
            socket.removeAllListeners("sync_player");

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
                const leaveMsg = {
                    id: Date.now(),
                    type: "system" as const,
                    text: `${userName} 离开了房间`,
                };
                room.chat.push(leaveMsg);
                if (room.chat.length > 100) room.chat.shift();
                roomService.saveRooms(); // 持久化离开
                io.to(roomId).emit("chat_message", leaveMsg);

                // 空房延时清理（5分钟后没人进入则销毁）
                if (room.users.length === 0) {
                    roomService.scheduleRoomDestruction(roomId);
                }
            });

            socket.on("chat_message", (text: string) => {
                const msg = { id: Date.now(), type: "user" as const, userName, text };
                room.chat.push(msg);
                if (room.chat.length > 100) room.chat.shift();
                roomService.saveRooms(); // 持久化聊天
                io.to(roomId).emit("chat_message", msg);
            });

            socket.on("add_song", (song: any) => {
                const singerName = roomService.formatSinger(song.singer);
                // 确保 albummid 正确提取
                const albummid = song.albummid || (song.album && song.album.mid) || song.album_mid || '';

                const newSong = {
                    ...song,
                    albummid,
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
                    const msg = { id: Date.now(), type: "system" as const, text: `${userName} 点了歌曲《${song.songname}》` };
                    room.chat.push(msg);
                    if (room.chat.length > 100) room.chat.shift();
                    roomService.saveRooms(); // 持久化更新

                    io.to(roomId).emit("room_state", roomService.getSafeRoomState(room));
                    io.to(roomId).emit("chat_message", msg);
                }
            });

            socket.on("skip_song", (isAuto?: boolean) => {
                const skippedSongName = room.currentSong?.songname;
                logInfo(TAG, "跳过歌曲", {
                    roomId,
                    userName,
                    skippedSong: skippedSongName ?? "无",
                    isAuto: !!isAuto
                });

                room.lastSkipTime = Date.now();
                roomService.playNextSong(room, roomId, io, isAuto);

                // 只有手动切歌才在聊天栏提示
                if (skippedSongName && !isAuto) {
                    const msg = { id: Date.now(), type: "system" as const, text: `${userName} 切歌了` };
                    room.chat.push(msg);
                    if (room.chat.length > 100) room.chat.shift();
                    io.to(roomId).emit("chat_message", msg);
                }
            });

            socket.on("reorder_queue", ({ oldIndex, newIndex }) => {
                if (oldIndex < 0 || oldIndex >= room.queue.length || newIndex < 0 || newIndex >= room.queue.length) return;
                const [item] = room.queue.splice(oldIndex, 1);
                room.queue.splice(newIndex, 0, item);
                roomService.saveRooms(); // 持久化排序
                logInfo(TAG, "队列重排序", { roomId, userName, oldIndex, newIndex, songName: item.songname });
                io.to(roomId).emit("room_state", roomService.getSafeRoomState(room));
            });

            socket.on("remove_song", (index: number) => {
                if (index >= 0 && index < room.queue.length) {
                    const removed = room.queue.splice(index, 1)[0];
                    roomService.saveRooms(); // 持久化移除
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
                const wasPlaying = room.isPlaying;
                room.currentTime = currentTime;
                room.isPlaying = isPlaying;
                io.to(roomId).emit("player_sync", { currentTime, isPlaying });

                // 如果刚刚发生了切歌（3秒内），则不展示暂停/播放气泡，避免干扰
                const isRecentlySkipped = room.lastSkipTime && (Date.now() - room.lastSkipTime < 3000);

                if (wasPlaying !== isPlaying && !isRecentlySkipped) {
                    const msg = {
                        id: Date.now(),
                        type: "system" as const,
                        text: isPlaying ? `${userName} 恢复了播放` : `${userName} 暂停了播放`
                    };
                    room.chat.push(msg);
                    if (room.chat.length > 100) room.chat.shift();
                    roomService.saveRooms(); // 持久化同步状态
                    io.to(roomId).emit("chat_message", msg);
                }
            });

            socket.on("play_songs", (songs: any[]) => {
                if (!Array.isArray(songs) || songs.length === 0) return;

                // 转换并归一化歌曲格式
                const normalizedSongs = songs.map(s => {
                    const albummid = s.albummid || (s.album && s.album.mid) || s.album_mid || '';
                    return {
                        ...s,
                        id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                        songmid: s.songmid || s.mid,
                        songname: s.songname || s.name || s.title,
                        albummid,
                        singer: roomService.formatSinger(s.singer || s.singer_name || s.artist_name),
                        requestedBy: userName,
                    };
                });

                // 替换当前队列
                room.queue = normalizedSongs;

                logInfo(TAG, "批量播放歌曲", { roomId, userName, count: normalizedSongs.length });

                room.lastSkipTime = Date.now();
                // 立即切歌
                roomService.playNextSong(room, roomId, io);

                const msg = {
                    id: Date.now(),
                    type: "system" as const,
                    text: `${userName} 开启了电台/批量播放 (${normalizedSongs.length}首)`
                };
                room.chat.push(msg);
                if (room.chat.length > 100) room.chat.shift();
                roomService.saveRooms();
                io.to(roomId).emit("chat_message", msg);
            });

            socket.on("clear_queue", () => {
                room.queue = [];
                logInfo(TAG, "清空队列", { roomId, userName });
                io.to(roomId).emit("room_state", roomService.getSafeRoomState(room));
                roomService.saveRooms();
            });
        });
    });
}
