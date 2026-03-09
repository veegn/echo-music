import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { useStore } from '../store';

/**
 * 格式化歌手显示（兼容 string 和 {name}[] 两种格式）
 */
function formatSinger(singer: unknown): string {
    if (Array.isArray(singer)) {
        return singer.map((s: any) => s.name || s).join(', ');
    }
    if (typeof singer === 'string') return singer;
    return '未知歌手';
}

export default function QueuePanel({ isHost }: { isHost: boolean }) {
    const { room, reorderQueue, removeSong } = useStore();

    return (
        <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 border-b border-zinc-800/50">
                <h3 className="text-sm font-semibold">播放队列</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {room?.queue.length === 0 ? (
                    <div className="text-center text-zinc-500 text-sm py-8">队列为空</div>
                ) : (
                    <AnimatePresence>
                        {room?.queue.map((song, i) => (
                            <motion.div
                                key={song.id}
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                                className="flex items-center gap-3 p-2 hover:bg-zinc-800/30 rounded-lg group"
                            >
                                <div className="w-6 text-center text-xs text-zinc-500 font-mono">{i + 1}</div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium truncate">{song.songname}</div>
                                    <div className="text-xs text-zinc-500 truncate">{formatSinger(song.singer)}</div>
                                </div>
                                <div className="text-[10px] text-zinc-500 shrink-0 flex flex-col items-end gap-1">
                                    <span>by {song.requestedBy}</span>
                                    {isHost && (
                                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => reorderQueue(i, Math.max(0, i - 1))}
                                                disabled={i === 0}
                                                className="p-1 hover:bg-zinc-700 rounded disabled:opacity-30"
                                            >
                                                <ArrowUp className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={() => reorderQueue(i, Math.min(room.queue.length - 1, i + 1))}
                                                disabled={i === room.queue.length - 1}
                                                className="p-1 hover:bg-zinc-700 rounded disabled:opacity-30"
                                            >
                                                <ArrowDown className="w-3 h-3" />
                                            </button>
                                            <button
                                                onClick={() => removeSong(i)}
                                                className="p-1 hover:bg-red-500/20 text-red-400 rounded"
                                            >
                                                <Trash2 className="w-3 h-3" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}
