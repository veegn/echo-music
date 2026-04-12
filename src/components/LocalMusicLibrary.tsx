import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Disc3,
  Library,
  Pause,
  Play,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";

type LocalTrack = {
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

type LocalMusicStats = {
  totalTracks: number;
  totalAudioSize: number;
  totalCoverSize: number;
  totalSize: number;
  latestCachedAt: string;
  cacheWritesPaused: boolean;
  cacheWriteError: string;
  cacheWriteUpdatedAt: string;
};

type LocalTrackListResponse = {
  list: LocalTrack[];
  total: number;
  page: number;
  pageSize: number;
};

type CacheJobInfo = {
  id: string;
  songmid: string;
  type: "cache" | "recache" | "delete" | "deleteMany";
  status: "pending" | "running" | "succeeded" | "failed";
  error?: string;
  updatedAt: string;
};

const PAGE_SIZE = 20;

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

const getSongmidFromPathname = (pathname: string) => {
  const match = pathname.match(/^\/local-music\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

function updateSeoMeta(selectedTrack: LocalTrack | null) {
  const title = selectedTrack
    ? `${selectedTrack.songname} - ${selectedTrack.singer} | Echo Music 本地音乐`
    : "Echo Music 本地音乐库 - 免登录搜索和播放缓存音乐";
  const description = selectedTrack
    ? `${selectedTrack.songname}，歌手 ${selectedTrack.singer}，专辑 ${selectedTrack.albumname}。${selectedTrack.intro || "本地缓存音乐详情与播放器页面。"}`
    : "Echo Music 本地音乐库，支持免登录搜索、浏览和播放已缓存到本地的歌曲、封面与简介。";
  const canonical = selectedTrack
    ? `${window.location.origin}/local-music/${encodeURIComponent(selectedTrack.songmid)}`
    : `${window.location.origin}/local-music`;
  const image = selectedTrack?.coverUrl
    ? `${window.location.origin}${selectedTrack.coverUrl}`
    : `${window.location.origin}/favicon.ico`;

  document.title = title;

  const setMeta = (selector: string, attr: "content" | "href", value: string) => {
    const element = document.querySelector(selector);
    if (element) element.setAttribute(attr, value);
  };

  setMeta('meta[name="description"]', "content", description);
  setMeta('meta[property="og:title"]', "content", title);
  setMeta('meta[property="og:description"]', "content", description);
  setMeta('meta[property="og:url"]', "content", canonical);
  setMeta('meta[property="og:image"]', "content", image);
  setMeta('meta[name="twitter:title"]', "content", title);
  setMeta('meta[name="twitter:description"]', "content", description);
  setMeta('meta[name="twitter:image"]', "content", image);
  setMeta('link[rel="canonical"]', "href", canonical);
}

function LocalPlayerModal({
  track,
  busy,
  onClose,
  onRecache,
  onDelete,
}: {
  track: LocalTrack | null;
  busy: "refresh" | "delete" | null;
  onClose: () => void;
  onRecache: () => void;
  onDelete: () => void;
}) {
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
                    Local Player
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
                        本地缓存大小 {formatSize(track.audioSize)}
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
                本地简介
              </div>
              <p className="text-sm leading-7 text-zinc-300">
                {track.intro || "暂无本地简介。"}
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
}

export default function LocalMusicLibrary({ onBack }: { onBack: () => void }) {
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<LocalTrack[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedTrack, setSelectedTrack] = useState<LocalTrack | null>(null);
  const [stats, setStats] = useState<LocalMusicStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"refresh" | "delete" | null>(null);
  const [selectedSongmid, setSelectedSongmid] = useState<string | null>(() => getSongmidFromPathname(window.location.pathname));
  const [selectedSongmids, setSelectedSongmids] = useState<string[]>([]);

  const endpoint = useMemo(() => (
    query.trim()
      ? `/api/local-music/search?q=${encodeURIComponent(query.trim())}&page=${page}&pageSize=${PAGE_SIZE}`
      : `/api/local-music/tracks?page=${page}&pageSize=${PAGE_SIZE}`
  ), [page, query]);

  const loadStats = async () => {
    const res = await fetch("/api/local-music/stats");
    const data = await res.json();
    setStats(data);
  };

  const loadTrackDetail = async (songmid: string): Promise<LocalTrack | null> => {
    const res = await fetch(`/api/local-music/tracks/${encodeURIComponent(songmid)}`);
    if (!res.ok) return null;
    return res.json();
  };

  const waitForCacheJob = async (jobId: string): Promise<CacheJobInfo> => {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const res = await fetch(`/api/local-music/jobs/${encodeURIComponent(jobId)}`);
      const data: CacheJobInfo & { error?: string } = await res.json();
      if (!res.ok) throw new Error(data?.error || "缓存任务查询失败");
      if (data.status === "succeeded" || data.status === "failed") {
        return data;
      }
      await new Promise((resolve) => { window.setTimeout(resolve, 1000); });
    }
    throw new Error("缓存任务执行超时");
  };

  const loadTracks = async () => {
    setLoading(true);
    try {
      const res = await fetch(endpoint);
      const data: LocalTrackListResponse = await res.json();
      const nextList = Array.isArray(data?.list) ? data.list : [];
      setTracks(nextList);
      setTotal(Number(data?.total || 0));

      if (selectedSongmid) {
        const nextTrack = nextList.find((item) => item.songmid === selectedSongmid)
          || await loadTrackDetail(selectedSongmid);
        setSelectedTrack(nextTrack);
      } else {
        setSelectedTrack(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTracks();
  }, [endpoint, selectedSongmid]);

  useEffect(() => {
    setSelectedSongmids((current) => current.filter((songmid) => tracks.some((track) => track.songmid === songmid)));
  }, [tracks]);

  useEffect(() => {
    setPage(1);
  }, [query]);

  useEffect(() => {
    void loadStats();
  }, []);

  useEffect(() => {
    const handlePopState = () => setSelectedSongmid(getSongmidFromPathname(window.location.pathname));
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  useEffect(() => {
    updateSeoMeta(selectedTrack);
  }, [selectedTrack]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const selectTrack = (track: LocalTrack) => {
    setSelectedTrack(track);
    setSelectedSongmid(track.songmid);
    window.history.pushState({}, "", `/local-music/${encodeURIComponent(track.songmid)}`);
  };

  const closeTrackModal = () => {
    setSelectedTrack(null);
    setSelectedSongmid(null);
    window.history.pushState({}, "", "/local-music");
  };

  const toggleTrackSelection = (songmid: string) => {
    setSelectedSongmids((current) => (
      current.includes(songmid)
        ? current.filter((item) => item !== songmid)
        : [...current, songmid]
    ));
  };

  const handleRecache = async () => {
    if (!selectedTrack) return;
    setBusy("refresh");

    try {
      const res = await fetch(`/api/local-music/tracks/${encodeURIComponent(selectedTrack.songmid)}/recache`, {
        method: "POST",
      });
      const data: { error?: string; job?: CacheJobInfo } = await res.json();
      if (!res.ok || !data?.job?.id) {
        throw new Error(data?.error || "重新缓存失败");
      }

      const job = await waitForCacheJob(data.job.id);
      if (job.status === "failed") {
        throw new Error(job.error || "重新缓存失败");
      }

      await loadTracks();
      await loadStats();

      const refreshed = await loadTrackDetail(selectedTrack.songmid);
      if (refreshed) {
        setSelectedTrack(refreshed);
      }
    } catch (error) {
      window.alert((error as Error).message || "重新缓存失败");
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!selectedTrack) return;
    if (!window.confirm(`确认删除本地缓存《${selectedTrack.songname}》吗？`)) return;

    setBusy("delete");
    try {
      const res = await fetch(`/api/local-music/tracks/${encodeURIComponent(selectedTrack.songmid)}`, {
        method: "DELETE",
      });
      const data: { error?: string; job?: CacheJobInfo } = await res.json();
      if (!res.ok || !data?.job?.id) {
        throw new Error(data?.error || "删除缓存失败");
      }

      const job = await waitForCacheJob(data.job.id);
      if (job.status === "failed") {
        throw new Error(job.error || "删除缓存失败");
      }

      setSelectedSongmids((current) => current.filter((songmid) => songmid !== selectedTrack.songmid));
      closeTrackModal();
      await loadTracks();
      await loadStats();
    } catch (error) {
      window.alert((error as Error).message || "删除缓存失败");
    } finally {
      setBusy(null);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSongmids.length === 0) return;
    if (!window.confirm(`确认删除选中的 ${selectedSongmids.length} 首本地缓存音乐吗？`)) return;

    setBusy("delete");
    try {
      const res = await fetch("/api/local-music/tracks/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ songmids: selectedSongmids }),
      });
      const data: { error?: string; job?: CacheJobInfo } = await res.json();
      if (!res.ok || !data?.job?.id) {
        throw new Error(data?.error || "批量删除缓存失败");
      }

      const job = await waitForCacheJob(data.job.id);
      if (job.status === "failed") {
        throw new Error(job.error || "批量删除缓存失败");
      }

      if (selectedTrack && selectedSongmids.includes(selectedTrack.songmid)) {
        closeTrackModal();
      }
      setSelectedSongmids([]);
      await loadTracks();
      await loadStats();
    } catch (error) {
      window.alert((error as Error).message || "批量删除缓存失败");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-zinc-950 text-zinc-50">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_25%)]" />

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <div className="glass-panel mb-8 flex flex-col gap-4 rounded-[28px] px-5 py-4">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div className="flex items-center gap-4">
              <button
                onClick={onBack}
                className="flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/70 transition-colors hover:border-emerald-500/30 hover:text-emerald-400"
                title="返回大厅"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div>
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-emerald-400">
                  <Library className="h-4 w-4" />
                  Local Music
                </div>
                <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">本地音乐曲库</h1>
                <p className="mt-1 text-sm text-zinc-400">
                  查看缓存统计，管理本地缓存，并在弹窗中直接播放本地音乐。
                </p>
              </div>
            </div>

            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索歌曲、歌手、专辑、简介"
                className="w-full rounded-2xl border border-zinc-800 bg-zinc-900/70 py-3 pl-11 pr-4 text-sm text-zinc-100 outline-none focus:border-emerald-500/40"
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div className="rounded-[24px] border border-zinc-800/60 bg-zinc-900/55 p-5">
              <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.26em] text-emerald-400">
                曲库概览
              </div>
              <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/70 p-4">
                  <div className="text-[11px] uppercase tracking-widest text-zinc-500">缓存歌曲</div>
                  <div className="mt-2 text-xl font-black">{stats?.totalTracks ?? 0}</div>
                </div>
                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/70 p-4">
                  <div className="text-[11px] uppercase tracking-widest text-zinc-500">音频体积</div>
                  <div className="mt-2 text-xl font-black">{formatSize(stats?.totalAudioSize ?? 0)}</div>
                </div>
                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/70 p-4">
                  <div className="text-[11px] uppercase tracking-widest text-zinc-500">封面体积</div>
                  <div className="mt-2 text-xl font-black">{formatSize(stats?.totalCoverSize ?? 0)}</div>
                </div>
                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/70 p-4">
                  <div className="text-[11px] uppercase tracking-widest text-zinc-500">总缓存</div>
                  <div className="mt-2 text-xl font-black">{formatSize(stats?.totalSize ?? 0)}</div>
                </div>
              </div>
            </div>

            <div className="rounded-[24px] border border-zinc-800/60 bg-zinc-900/55 p-5">
              <div className="mb-4 text-[11px] font-bold uppercase tracking-[0.26em] text-emerald-400">
                曲库操作
              </div>
              <div className="space-y-3">
                <button
                  onClick={() => {
                    void loadTracks();
                    void loadStats();
                  }}
                  className="w-full rounded-2xl border border-emerald-500/30 bg-emerald-500/15 px-4 py-3 text-left transition-colors hover:bg-emerald-500/20"
                >
                  <div className="flex items-center gap-2 font-semibold text-emerald-300">
                    <RefreshCw className="h-4 w-4" />
                    刷新曲库索引
                  </div>
                  <div className="mt-1 text-sm text-zinc-400">重新读取本地缓存目录和统计信息。</div>
                </button>

                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/70 px-4 py-3">
                  <div className="text-sm font-semibold text-zinc-200">最近缓存时间</div>
                  <div className="mt-1 text-sm text-zinc-500">{formatTime(stats?.latestCachedAt || "")}</div>
                </div>

                {stats?.cacheWritesPaused && (
                  <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3">
                    <div className="text-sm font-semibold text-amber-200">缓存写入已暂停</div>
                    <div className="mt-1 text-sm text-amber-100/90">
                      {stats.cacheWriteError || "存储空间不足，新的缓存写入已暂停。"}
                    </div>
                    <div className="mt-1 text-xs text-amber-200/70">
                      更新时间 {formatTime(stats?.cacheWriteUpdatedAt || "")}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <section className="glass-card min-h-[640px] rounded-[28px] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">曲库列表</h2>
              <p className="mt-1 text-xs text-zinc-500">
                {loading
                  ? "正在读取缓存..."
                  : `共 ${total} 首缓存歌曲，当前第 ${page}/${totalPages} 页`}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="text-xs text-zinc-500">已选 {selectedSongmids.length} 首</div>
              <button
                onClick={() => void handleBulkDelete()}
                disabled={busy !== null || selectedSongmids.length === 0}
                className="rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-1.5 text-sm text-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
              >
                批量删除
              </button>
            </div>
          </div>

          <div className="custom-scrollbar grid max-h-[720px] gap-2.5 overflow-y-auto pr-1">
            {tracks.map((track) => (
              <div
                key={track.songmid}
                className="flex items-center gap-3 rounded-[24px] border border-zinc-800/60 bg-zinc-900/45 px-4 py-3 transition-all hover:border-emerald-500/25 hover:bg-zinc-900/85"
              >
                <label className="flex shrink-0 items-center">
                  <input
                    type="checkbox"
                    checked={selectedSongmids.includes(track.songmid)}
                    onChange={() => toggleTrackSelection(track.songmid)}
                    className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-emerald-500/40"
                  />
                </label>
                <button
                  onClick={() => selectTrack(track)}
                  className="min-w-0 flex-1 text-left"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={track.coverUrl}
                      alt={track.songname}
                      className="h-16 w-16 rounded-2xl bg-zinc-900 object-cover shadow-lg"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-zinc-100">{track.songname}</div>
                      <div className="mt-1 truncate text-xs text-zinc-400">{track.singer}</div>
                      <div className="mt-1 truncate text-[11px] text-zinc-500">{track.albumname}</div>
                    </div>
                    <div className="shrink-0 text-right">
                      <div className="text-xs font-semibold text-zinc-300">{formatSize(track.audioSize)}</div>
                      <div className="mt-1 text-[11px] text-zinc-500">点击播放</div>
                    </div>
                  </div>
                </button>
              </div>
            ))}

            {!loading && tracks.length === 0 && (
              <div className="py-16 text-center text-sm text-zinc-500">当前还没有本地缓存音乐。</div>
            )}
          </div>

          {total > PAGE_SIZE && (
            <div className="mt-5 flex items-center justify-between rounded-2xl border border-zinc-800/60 bg-zinc-900/45 px-4 py-3">
              <div className="text-xs text-zinc-500">每页 {PAGE_SIZE} 首，共 {totalPages} 页</div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={page <= 1}
                  className="rounded-xl border border-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:border-emerald-500/30 hover:text-emerald-300 disabled:opacity-40"
                >
                  上一页
                </button>
                <button
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={page >= totalPages}
                  className="rounded-xl border border-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:border-emerald-500/30 hover:text-emerald-300 disabled:opacity-40"
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <LocalPlayerModal
        track={selectedTrack}
        busy={busy}
        onClose={closeTrackModal}
        onRecache={handleRecache}
        onDelete={handleDelete}
      />
    </div>
  );
}
