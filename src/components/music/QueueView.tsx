import React from 'react';
import { motion } from 'framer-motion';
import { ArrowUp, ArrowDown, Trash2 } from 'lucide-react';
import { formatSinger } from '../../utils/music';

interface QueueViewProps {
  queue: any[];
  isHost: boolean;
  onReorder: (from: number, to: number) => void;
  onRemove: (index: number) => void;
}

export default function QueueView({ queue, isHost, onReorder, onRemove }: QueueViewProps) {
  return (
    <motion.div 
      key="queue" 
      initial={{ opacity: 0, scale: 0.95 }} 
      animate={{ opacity: 1, scale: 1 }} 
      exit={{ opacity: 0, scale: 0.95 }} 
      className="h-full"
    >
      <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center justify-between">
        <span>播放队列 ({queue.length})</span>
      </div>
      {queue.length === 0 ? (
        <div className="text-center text-zinc-500 text-sm py-8">队列为空</div>
      ) : (
        <div className="space-y-2">
          {queue.map((song, index) => (
            <div key={song.id} className="flex items-center gap-2 sm:gap-3 p-2 bg-zinc-900/40 hover:bg-zinc-800/60 rounded-xl border border-transparent hover:border-zinc-700/50 transition-all group">
              <div className="w-5 sm:w-6 text-center text-[10px] sm:text-xs text-zinc-500 font-mono">{index + 1}</div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] sm:text-sm font-medium text-zinc-100 truncate">{song.songname}</div>
                <div className="text-[11px] sm:text-xs text-zinc-500 truncate">{formatSinger(song.singer)}</div>
              </div>
              <div className="text-[9px] sm:text-[10px] text-zinc-500 shrink-0 flex flex-col items-end gap-0.5">
                <span className="max-w-[60px] truncate">点歌人: {song.requestedBy}</span>
                {isHost && (
                  <div className="flex items-center gap-0.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => onReorder(index, Math.max(0, index - 1))} 
                      disabled={index === 0} 
                      className="p-0.5 hover:bg-zinc-700 rounded disabled:opacity-30"
                    >
                      <ArrowUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    </button>
                    <button 
                      onClick={() => onReorder(index, Math.min(queue.length - 1, index + 1))} 
                      disabled={index === queue.length - 1} 
                      className="p-0.5 hover:bg-zinc-700 rounded disabled:opacity-30"
                    >
                      <ArrowDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    </button>
                    <button 
                      onClick={() => onRemove(index)} 
                      className="p-0.5 hover:bg-red-500/20 text-red-400 rounded"
                    >
                      <Trash2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
}
