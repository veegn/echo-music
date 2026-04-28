import React from 'react';
import { motion } from 'framer-motion';
import { Music, Volume2 } from 'lucide-react';
import Lyrics from './Lyrics';
import PlayerInfo from './player/PlayerInfo';
import ProgressBar from './player/ProgressBar';
import PlayerControls from './player/PlayerControls';
import { RoomState } from '../types';

interface PlayerViewProps {
  room: RoomState | null;
  isHost: boolean;
  audioUrl: string;
  audioRef: React.RefObject<HTMLAudioElement | null>;
  localCurrentTime: number;
  duration: number;
  needsAudioActivation: boolean;
  onTogglePlay: () => void;
  onSkip: (isAuto?: boolean) => void;
  onOpenCookieDialog: () => void;
  onActivateAudio: () => void;
  onTimeUpdate: () => void;
  onLoadedMetadata: () => void;
  onPlayPause: () => void;
  onEnded: () => void;
  onSeek: (nextTime: number) => void;
  audioNextRef: React.RefObject<HTMLAudioElement | null>;
}

export default function PlayerView({
  room,
  isHost,
  audioUrl,
  audioRef,
  localCurrentTime,
  duration,
  needsAudioActivation,
  onTogglePlay,
  onSkip,
  onOpenCookieDialog,
  onActivateAudio,
  onTimeUpdate,
  onLoadedMetadata,
  onPlayPause,
  onEnded,
  onSeek,
  audioNextRef,
}: PlayerViewProps) {
  return (
    <div className="flex-1 flex flex-col min-h-0 bg-zinc-950 text-white relative overflow-hidden">
      {/* Background Ambient Glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={room?.isPlaying ? {
            scale: [1, 1.2, 1],
            opacity: [0.1, 0.2, 0.1],
          } : { scale: 1, opacity: 0 }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/2 left-1/2 w-[400px] h-[400px] -translate-x-1/2 -translate-y-1/2 bg-black/30 rounded-full mix-blend-overlay filter blur-[80px]"
        />
      </div>

      <div className="flex-1 w-full overflow-y-auto overflow-x-hidden flex flex-col items-center p-3 pb-[calc(0.75rem_+_env(safe-area-inset-bottom))] sm:p-8 relative z-10 custom-scrollbar">
        <div className="w-full max-w-5xl flex flex-col items-center gap-4 sm:gap-8 relative z-10 my-auto py-2 sm:py-4">
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
              <audio
                ref={audioRef}
                src={audioUrl || undefined}
                playsInline
                preload="metadata"
                crossOrigin="anonymous"
                onTimeUpdate={onTimeUpdate}
                onLoadedMetadata={onLoadedMetadata}
                onPlay={onPlayPause}
                onPause={onPlayPause}
                onEnded={onEnded}
                className="absolute h-0 w-0 opacity-0 pointer-events-none"
              />
              <audio
                ref={audioNextRef}
                playsInline
                preload="auto"
                crossOrigin="anonymous"
                className="absolute h-0 w-0 opacity-0 pointer-events-none"
              />

              <PlayerInfo currentSong={room?.currentSong} />

              <div>
                <ProgressBar 
                  currentTime={localCurrentTime} 
                  duration={duration} 
                  onSeek={onSeek} 
                />

                <PlayerControls 
                  isPlaying={!!room?.isPlaying}
                  hasCurrentSong={!!room?.currentSong}
                  isHost={isHost}
                  hasCookie={!!room?.hasCookie}
                  hostQQId={room?.hostQQId}
                  onTogglePlay={onTogglePlay}
                  onSkip={() => onSkip()}
                  onOpenCookieDialog={onOpenCookieDialog}
                />
              </div>
            </div>

            <motion.div
              className="w-full max-w-[280px] sm:max-w-xs mx-auto md:max-w-none md:mx-0 md:w-72 lg:w-80 aspect-square md:aspect-auto md:h-full shrink-0 bg-zinc-950 relative overflow-hidden flex-none"
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

          <div className="w-full max-w-2xl px-1 sm:px-4 text-center h-36 sm:h-48 flex flex-col justify-center">
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
