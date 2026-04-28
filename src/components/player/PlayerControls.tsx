import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Pause, Play, SkipForward, Settings } from 'lucide-react';

interface PlayerControlsProps {
  isPlaying: boolean;
  hasCurrentSong: boolean;
  isHost: boolean;
  hasCookie: boolean;
  hostQQId?: string | null;
  onTogglePlay: () => void;
  onSkip: () => void;
  onOpenCookieDialog: () => void;
}

export default function PlayerControls({
  isPlaying,
  hasCurrentSong,
  isHost,
  hasCookie,
  hostQQId,
  onTogglePlay,
  onSkip,
  onOpenCookieDialog,
}: PlayerControlsProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-6">
        <button
          onClick={onTogglePlay}
          disabled={!hasCurrentSong}
          className="text-zinc-300 hover:text-white disabled:opacity-30 transition-all bg-transparent border-0 relative flex items-center justify-center w-11 h-11 active:scale-90 cursor-pointer"
          title={isPlaying ? '暂停' : '播放'}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={isPlaying ? 'pause' : 'play'}
              initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
              transition={{ duration: 0.15, ease: 'easeInOut' }}
              className="absolute inset-0 flex items-center justify-center cursor-pointer"
            >
              {isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
            </motion.div>
          </AnimatePresence>
        </button>
        <button
          onClick={onSkip}
          disabled={!hasCurrentSong}
          title="下一首 / 切歌"
          className="text-zinc-300 hover:text-white disabled:opacity-30 transition-all bg-transparent border-0 active:scale-90 cursor-pointer flex h-11 w-11 items-center justify-center"
        >
          <SkipForward className="w-6 h-6 fill-current" />
        </button>
      </div>

      {isHost ? (
        <button
          onClick={onOpenCookieDialog}
          className={`shrink-0 flex items-center gap-1.5 px-2 py-1 text-xs font-medium cursor-pointer transition-colors bg-transparent border-0 ${hasCookie ? 'text-emerald-500/80 hover:text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
        >
          <Settings className="w-3.5 h-3.5" />
          <span>
            {hasCookie
              ? hostQQId
                ? `已绑定 VIP（QQ: ${hostQQId}）`
                : '已绑定 VIP'
              : '绑定 VIP'}
          </span>
        </button>
      ) : (
        <div />
      )}
    </div>
  );
}
