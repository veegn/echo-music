import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Music, Pause, Play, Settings, SkipForward, Volume2 } from 'lucide-react';
import Lyrics from './Lyrics';
import { RoomState } from '../types';

function formatSinger(singer: unknown): string {
  if (Array.isArray(singer)) return singer.map((s: any) => s.name).join(' / ');
  if (typeof singer === 'string') return singer;
  return '';
}

interface PlayerViewProps {
  room: RoomState | null;
  isHost: boolean;
  audioUrl: string;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  localCurrentTime: number;
  duration: number;
  needsAudioActivation: boolean;
  isSyncLeader: boolean;
  onTogglePlay: () => void;
  onSkip: (isAuto?: boolean) => void;
  onOpenCookieDialog: () => void;
  onActivateAudio: () => void;
  onTimeUpdate: () => void;
  onLoadedMetadata: () => void;
  onPlayPause: () => void;
  onSeek: (nextTime: number) => void;
}

export default function PlayerView({
  room,
  isHost,
  audioUrl,
  audioRef,
  localCurrentTime,
  duration,
  needsAudioActivation,
  isSyncLeader,
  onTogglePlay,
  onSkip,
  onOpenCookieDialog,
  onActivateAudio,
  onTimeUpdate,
  onLoadedMetadata,
  onPlayPause,
  onSeek,
}: PlayerViewProps) {
  const seekFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!duration) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const pos = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    onSeek(pos * duration);
  };

  return (
    <div className="w-full h-full relative z-10 flex flex-col min-h-0 overflow-hidden">
      <div className="absolute -inset-40 pointer-events-none -z-20 overflow-hidden">
        <AnimatePresence mode="popLayout">
          {room?.currentSong && (
            <motion.img
              key={room.currentSong.songmid}
              initial={{ opacity: 0, scale: 1.2 }}
              animate={{ opacity: 0.6, scale: room.isPlaying ? 1.5 : 1.2 }}
              exit={{ opacity: 0, scale: 1.2 }}
              transition={{
                opacity: { duration: 1.5 },
                scale: { duration: 20, ease: 'linear', repeat: Infinity, repeatType: 'reverse' },
              }}
              src={`https://y.qq.com/music/photo_new/T002R300x300M000${room.currentSong.albummid || room.currentSong.album?.mid}.jpg`}
              className="absolute top-0 left-0 w-full h-full object-cover blur-[80px] saturate-[1.2]"
              alt=""
              referrerPolicy="no-referrer"
            />
          )}
        </AnimatePresence>
        <div className="absolute inset-0 bg-zinc-950/60 mix-blend-overlay" />
        <div className="absolute inset-0 bg-zinc-950/40" />
      </div>

      <div className={`absolute -inset-40 pointer-events-none -z-10 transition-opacity duration-1000 ${room?.isPlaying ? 'opacity-100' : 'opacity-0'} overflow-hidden`}>
        <motion.div
          animate={room?.isPlaying ? {
            scale: [1, 1.4, 0.9, 1.3, 1],
            opacity: [0.1, 0.3, 0.1, 0.4, 0.1],
            rotate: [0, 90, 180, 270, 360],
          } : { scale: 1, opacity: 0, rotate: 0 }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/2 left-1/4 w-[500px] h-[500px] -translate-y-1/2 bg-white/20 rounded-full mix-blend-overlay filter blur-[100px]"
        />
        <motion.div
          animate={room?.isPlaying ? {
            scale: [1, 1.5, 1, 1.4, 1],
            opacity: [0.1, 0.2, 0.1, 0.3, 0.1],
            rotate: [360, 270, 180, 90, 0],
          } : { scale: 1, opacity: 0, rotate: 0 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/3 left-1/2 w-[600px] h-[600px] -translate-y-1/2 bg-white/20 rounded-full mix-blend-overlay filter blur-[120px]"
        />
        <motion.div
          animate={room?.isPlaying ? {
            scale: [0.8, 1.2, 0.8],
            opacity: [0.1, 0.2, 0.1],
          } : { scale: 1, opacity: 0 }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/2 left-1/2 w-[400px] h-[400px] -translate-x-1/2 -translate-y-1/2 bg-black/30 rounded-full mix-blend-overlay filter blur-[80px]"
        />
      </div>

      <div className="flex-1 w-full overflow-y-auto overflow-x-hidden flex flex-col items-center p-4 pb-[calc(env(safe-area-inset-bottom)_+_1rem)] sm:p-8 relative z-10 custom-scrollbar">
        <div className="w-full max-w-5xl flex flex-col items-center gap-6 sm:gap-8 relative z-10 my-auto py-4">
          {needsAudioActivation && room?.currentSong && (
            <button
              onClick={onActivateAudio}
              className="min-h-11 w-full max-w-xl flex items-center justify-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-100 shadow-lg shadow-black/20 active:scale-[0.99]"
            >
              <Volume2 className="h-5 w-5" />
              <span>点击启用音频播放</span>
            </button>
          )}

          <div className="w-full flex flex-col-reverse md:flex-row items-center md:items-stretch bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/50 rounded-3xl overflow-hidden shadow-2xl md:h-[320px]">
            <div className="flex-1 p-5 sm:p-6 md:p-8 flex flex-col justify-between w-full h-full">
              {audioUrl && (
                <audio
                  ref={audioRef}
                  src={audioUrl}
                  playsInline
                  preload="metadata"
                  onTimeUpdate={onTimeUpdate}
                  onLoadedMetadata={onLoadedMetadata}
                  onPlay={onPlayPause}
                  onPause={onPlayPause}
                  onEnded={() => isSyncLeader && onSkip(true)}
                  className="absolute h-0 w-0 opacity-0 pointer-events-none"
                />
              )}

              <div className="mb-6 mt-2 md:mt-0 min-h-[80px] flex flex-col justify-center">
                <h2 className="text-2xl sm:text-3xl font-bold mb-2 tracking-tight text-white line-clamp-2 leading-tight text-center md:text-left">
                  {room?.currentSong ? room.currentSong.songname : '还没有开始播放'}
                </h2>
                <p className="text-zinc-400 text-sm font-medium line-clamp-2 text-center md:text-left">
                  {room?.currentSong ? formatSinger(room.currentSong.singer) : '去右侧搜索歌曲，或者从歌单里挑一首开始吧。'}
                </p>
              </div>

              <div>
                <div className="flex items-center gap-3 mb-6">
                  <span className="text-xs text-zinc-500 font-mono w-10 text-right shrink-0">
                    {Math.floor(localCurrentTime / 60)}:{(Math.floor(localCurrentTime) % 60).toString().padStart(2, '0')}
                  </span>
                  <div
                    className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden relative cursor-pointer touch-none"
                    onPointerDown={(e) => {
                      e.currentTarget.setPointerCapture(e.pointerId);
                      seekFromPointer(e);
                    }}
                    onPointerMove={(e) => {
                      if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
                      seekFromPointer(e);
                    }}
                    onPointerUp={(e) => {
                      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                        e.currentTarget.releasePointerCapture(e.pointerId);
                      }
                    }}
                    onPointerCancel={(e) => {
                      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                        e.currentTarget.releasePointerCapture(e.pointerId);
                      }
                    }}
                  >
                    <motion.div
                      className="absolute top-0 left-0 h-full bg-emerald-500 rounded-full"
                      style={{ width: duration ? `${(localCurrentTime / duration) * 100}%` : '0%' }}
                      layout
                    />
                  </div>
                  <span className="text-xs text-zinc-500 font-mono w-10 text-left shrink-0">
                    {Math.floor(duration / 60)}:{(Math.floor(duration) % 60).toString().padStart(2, '0')}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-6">
                    <button
                      onClick={onTogglePlay}
                      disabled={!room?.currentSong}
                      className="text-zinc-300 hover:text-white disabled:opacity-30 transition-all bg-transparent border-0 relative flex items-center justify-center w-11 h-11 active:scale-90 cursor-pointer"
                      title={room?.isPlaying ? '暂停' : '播放'}
                    >
                      <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                          key={room?.isPlaying ? 'pause' : 'play'}
                          initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                          animate={{ opacity: 1, scale: 1, rotate: 0 }}
                          exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
                          transition={{ duration: 0.15, ease: 'easeInOut' }}
                          className="absolute inset-0 flex items-center justify-center cursor-pointer"
                        >
                          {room?.isPlaying ? <Pause className="w-6 h-6 fill-current" /> : <Play className="w-6 h-6 fill-current" />}
                        </motion.div>
                      </AnimatePresence>
                    </button>
                    <button
                      onClick={() => onSkip()}
                      disabled={!room?.currentSong}
                      title="下一首 / 切歌"
                      className="text-zinc-300 hover:text-white disabled:opacity-30 transition-all bg-transparent border-0 active:scale-90 cursor-pointer flex h-11 w-11 items-center justify-center"
                    >
                      <SkipForward className="w-6 h-6 fill-current" />
                    </button>
                  </div>

                  {isHost ? (
                    <button
                      onClick={onOpenCookieDialog}
                      className={`shrink-0 flex items-center gap-1.5 px-2 py-1 text-xs font-medium cursor-pointer transition-colors bg-transparent border-0 ${room?.hasCookie ? 'text-emerald-500/80 hover:text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                    >
                      <Settings className="w-3.5 h-3.5" />
                      <span>
                        {room?.hasCookie
                          ? room?.hostQQId
                            ? `已绑定 VIP（QQ: ${room.hostQQId}）`
                            : '已绑定 VIP'
                          : '绑定 VIP'}
                      </span>
                    </button>
                  ) : (
                    <div />
                  )}
                </div>
              </div>
            </div>

            <motion.div
              className="w-full md:w-72 lg:w-80 aspect-square md:aspect-auto md:h-full shrink-0 bg-zinc-950 relative overflow-hidden flex-none"
              animate={{ opacity: room?.isPlaying ? 1 : 0.9 }}
            >
              {room?.currentSong ? (
                <img
                  src={`https://y.qq.com/music/photo_new/T002R300x300M000${room.currentSong.albummid || room.currentSong.album?.mid}.jpg`}
                  alt="专辑封面"
                  className="w-full h-full object-cover transition-transform duration-1000"
                  style={{ transform: room?.isPlaying ? 'scale(1.05)' : 'scale(1)' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/music/300/300?blur=4';
                  }}
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-zinc-900 border-l border-zinc-800">
                  <Music className="w-16 h-16 text-zinc-800" />
                </div>
              )}
              {room?.isPlaying && <div className="absolute inset-0 bg-black/10 transition-colors" />}
            </motion.div>
          </div>

          <div className="w-full max-w-2xl px-2 sm:px-4 text-center h-44 sm:h-48 flex flex-col justify-center">
            {room?.currentSong ? (
              <Lyrics songmid={room.currentSong.songmid} currentTime={localCurrentTime} />
            ) : (
              <p className="text-zinc-600 text-sm italic">等待播放中...</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
