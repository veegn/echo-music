import React, { useRef, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Pause, Play, RefreshCw, Trash2, Disc3 } from "lucide-react";

type OfflineTrack = {
  songmid: string;
  songname: string;
  singer: string;
  albumname: string;
  intro: string;
  cachedAt: string;
  lastPlayedAt: string;
  audioSize: number;
  audioUrl: string;
  coverUrl: string;
};

const formatSize = (size: number) => {
  if (!size) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const formatTime = (value: string) =>
  value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "-";

const formatDuration = (seconds: number) => {
  if (!seconds || Number.isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

interface OfflinePlayerModalProps {
  track: OfflineTrack | null;
  busy: "refresh" | "delete" | null;
  onClose: () => void;
  onRecache: () => void;
  onDelete: () => void;
}

const OfflinePlayerModal: React.FC<OfflinePlayerModalProps> = ({
  track,
  busy,
  onClose,
  onRecache,
  onDelete,
}) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [autoPlayFailed, setAutoPlayFailed] = useState(false);

  useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setAutoPlayFailed(false);
  }, [track?.songmid]);

  useEffect(() => {
    if (!track || !audioRef.current) return;
    const audio = audioRef.current;
    audio.currentTime = 0;
    audio.play().then(() => {
      setIsPlaying(true);
      setAutoPlayFailed(false);
    }).catch(() => {
      setIsPlaying(false);
      setAutoPlayFailed(true);
    });
  }, [track?.songmid]);

  if (!track) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-xl sm:p-8"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 12, scale: 0.96 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-5xl overflow-hidden rounded-[36px] border border-zinc-800/60 bg-zinc-900/85 shadow-2xl"
        >
          <div className="pointer-events-none absolute -inset-40 -z-10 overflow-hidden">
            <motion.img
              key={track.songmid}
              initial={{ opacity: 0, scale: 1.15 }}
              animate={{ opacity: 0.55, scale: isPlaying ? 1.35 : 1.15 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{
                opacity: { duration: 0.6 },
                scale: { duration: 16, ease: "linear", repeat: Infinity, repeatType: "reverse" },
              }}
              src={track.coverUrl}
              alt=""
              className="absolute inset-0 h-full w-full object-cover blur-[88px] saturate-[1.1]"
            />
            <div className="absolute inset-0 bg-zinc-950/65" />
          </div>

          <button
            onClick={onClose}
            className="absolute right-5 top-5 z-20 flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-black/35 text-zinc-300 transition-colors hover:border-emerald-500/30 hover:text-white"
            title="关闭播放器"
          >
            <X className="h-5 w-5" />
          </button>

          <div className="relative z-10 p-5 sm:p-8">
            <div className="flex flex-col overflow-hidden rounded-[32px] border border-zinc-800/50 bg-zinc-900/55 shadow-2xl backdrop-blur-xl lg:min-h-[420px] lg:flex-row">
              <div className="flex flex-1 flex-col justify-between p-6 sm:p-8">
                <div>
                  <div className="mb-3 text-[11px] font-bold uppercase tracking-[0.28em] text-emerald-400">
                    Offline Library
                  </div>
                  <h2 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">
                    {track.songname}
                  </h2>
                  <p className="mt-3 text-base text-zinc-300 sm:text-lg">{track.singer}</p>
                  <p className="mt-1 text-sm text-zinc-500">{track.albumname}</p>
                </div>

                <div className="mt-8">
                  <div className="mb-6 flex items-center gap-3">
                    <span className="w-10 shrink-0 text-right font-mono text-xs text-zinc-500">
                      {formatDuration(currentTime)}
                    </span>
                    <div
                      className="relative h-2 flex-1 cursor-pointer overflow-hidden rounded-full bg-zinc-800"
                      onClick={(event) => {
                        if (!audioRef.current || !duration) return;
                        const rect = event.currentTarget.getBoundingClientRect();
                        const ratio = (event.clientX - rect.left) / rect.width;
                        audioRef.current.currentTime = ratio * duration;
                        setCurrentTime(audioRef.current.currentTime);
                      }}
                    >
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full bg-emerald-500"
                        style={{ width: duration ? `${(currentTime / duration) * 100}%` : "0%" }}
                      />
                    </div>
                    <span className="w-10 shrink-0 text-left font-mono text-xs text-zinc-500">
                      {formatDuration(duration)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-5">
                      <button
                        onClick={() => {
                          if (!audioRef.current) return;
                          if (audioRef.current.paused) {
                            audioRef.current.play().then(() => {
                              setIsPlaying(true);
                              setAutoPlayFailed(false);
                            }).catch(() => setAutoPlayFailed(true));
                          } else {
                            audioRef.current.pause();
                            setIsPlaying(false);
                          }
                        }}
                        className="flex h-10 w-10 cursor-pointer items-center justify-center border-0 bg-transparent text-zinc-200 transition-all hover:text-white active:scale-90"
                        title={isPlaying ? "暂停" : "播放"}
                      >
                        {isPlaying ? (
                          <Pause className="h-6 w-6 fill-current" />
                        ) : (
                          <Play className="h-6 w-6 fill-current" />
                        )}
                      </button>
                      <div className="text-xs text-zinc-500">
                        离线缓存大小 {formatSize(track.audioSize)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={onRecache}
                        disabled={busy !== null}
                        className="flex items-center gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/15 px-3.5 py-2 text-sm text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-50"
                      >
                        <RefreshCw className={`h-4 w-4 ${busy === "refresh" ? "animate-spin" : ""}`} />
                        重新缓存
                      </button>
                      <button
                        onClick={onDelete}
                        disabled={busy !== null}
                        className="flex items-center gap-2 rounded-2xl border border-red-500/25 bg-red-500/10 px-3.5 py-2 text-sm text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" />
                        删除缓存
                      </button>
                    </div>
                  </div>

                  <audio
                    ref={audioRef}
                    src={track.audioUrl}
                    preload="metadata"
                    onTimeUpdate={() => {
                      if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
                    }}
                    onLoadedMetadata={() => {
                      if (audioRef.current) setDuration(audioRef.current.duration || 0);
                    }}
                    onPlay={() => setIsPlaying(true)}
                    onPause={() => setIsPlaying(false)}
                    onEnded={() => setIsPlaying(false)}
                    className="hidden"
                  />
                </div>
              </div>

              <div className="relative aspect-square w-full overflow-hidden bg-zinc-950 lg:w-80 lg:aspect-auto xl:w-96">
                <img
                  src={track.coverUrl}
                  alt={track.songname}
                  className="h-full w-full object-cover transition-transform duration-1000"
                  style={{ transform: isPlaying ? "scale(1.05)" : "scale(1)" }}
                />
                <div className="absolute inset-0 bg-black/10" />
              </div>
            </div>

            <div className="mt-6 rounded-[28px] border border-zinc-800/50 bg-zinc-900/45 p-5 sm:p-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-400">
                <Disc3 className="h-4 w-4" />
                离线简介
              </div>
              <p className="text-sm leading-7 text-zinc-300">
                {track.intro || "暂无离线简介。"}
              </p>
              <div className="mt-5 grid gap-3 text-sm sm:grid-cols-3">
                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/60 p-4">
                  <div className="text-[11px] uppercase tracking-widest text-zinc-500">缓存时间</div>
                  <div className="mt-2 font-semibold text-zinc-100">{formatTime(track.cachedAt)}</div>
                </div>
                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/60 p-4">
                  <div className="text-[11px] uppercase tracking-widest text-zinc-500">最近播放</div>
                  <div className="mt-2 font-semibold text-zinc-100">{formatTime(track.lastPlayedAt)}</div>
                </div>
                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/60 p-4">
                  <div className="text-[11px] uppercase tracking-widest text-zinc-500">歌曲 MID</div>
                  <div className="mt-2 break-all font-semibold text-zinc-100">{track.songmid}</div>
                </div>
              </div>
            </div>

            {autoPlayFailed && (
              <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
                浏览器拦截了自动播放，请点击播放按钮继续。
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OfflinePlayerModal;
