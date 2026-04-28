import React, { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Library,
  RefreshCw,
  Search,
} from "lucide-react";
import { formatSize, formatTime } from "../utils/music";
import OfflinePlayerModal from "./offline/OfflinePlayerModal";
import OfflineTrackItem from "./offline/OfflineTrackItem";

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

type OfflineLibraryStats = {
  totalTracks: number;
  totalAudioSize: number;
  totalCoverSize: number;
  totalSize: number;
  latestCachedAt: string;
  cacheWritesPaused: boolean;
  cacheWriteError: string;
  cacheWriteUpdatedAt: string;
};

type OfflineTrackListResponse = {
  list: OfflineTrack[];
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

const getSongmidFromPathname = (pathname: string) => {
  const match = pathname.match(/^\/offline-library\/([^/?#]+)/);
  return match ? decodeURIComponent(match[1]) : null;
};

function updateSeoMeta(selectedTrack: OfflineTrack | null) {
  const title = selectedTrack
    ? `${selectedTrack.songname} - ${selectedTrack.singer} | Echo Music 离线曲库`
    : "Echo Music 离线曲库 - 免登录搜索和播放缓存音乐";
  const description = selectedTrack
    ? `${selectedTrack.songname}，歌手 ${selectedTrack.singer}，专辑 ${selectedTrack.albumname}。${selectedTrack.intro || "离线曲库详情与播放器页面。"}`
    : "Echo Music 离线曲库，支持免登录搜索、浏览和播放已缓存到本地的歌曲、封面与简介。";
  const canonical = selectedTrack
    ? `${window.location.origin}/offline-library/${encodeURIComponent(selectedTrack.songmid)}`
    : `${window.location.origin}/offline-library`;
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

export default function OfflineLibrary({ onClose }: { isOpen: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [tracks, setTracks] = useState<OfflineTrack[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [selectedTrack, setSelectedTrack] = useState<OfflineTrack | null>(null);
  const [stats, setStats] = useState<OfflineLibraryStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<"refresh" | "delete" | null>(null);
  const [selectedSongmid, setSelectedSongmid] = useState<string | null>(() => getSongmidFromPathname(window.location.pathname));
  const [selectedSongmids, setSelectedSongmids] = useState<string[]>([]);

  const endpoint = useMemo(() => (
    query.trim()
      ? `/api/offline-library/search?q=${encodeURIComponent(query.trim())}&page=${page}&pageSize=${PAGE_SIZE}`
      : `/api/offline-library/tracks?page=${page}&pageSize=${PAGE_SIZE}`
  ), [page, query]);

  const loadStats = async () => {
    try {
      const res = await fetch("/api/offline-library/stats");
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  };

  const loadTrackDetail = async (songmid: string): Promise<OfflineTrack | null> => {
    try {
      const res = await fetch(`/api/offline-library/tracks/${encodeURIComponent(songmid)}`);
      if (!res.ok) return null;
      return res.json();
    } catch {
      return null;
    }
  };

  const waitForCacheJob = async (jobId: string): Promise<CacheJobInfo> => {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const res = await fetch(`/api/offline-library/jobs/${encodeURIComponent(jobId)}`);
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
      const data: OfflineTrackListResponse = await res.json();
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
    } catch (err) {
      console.error("Failed to load tracks:", err);
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

  const selectTrack = (track: OfflineTrack) => {
    setSelectedTrack(track);
    setSelectedSongmid(track.songmid);
    window.history.pushState({}, "", `/offline-library/${encodeURIComponent(track.songmid)}`);
  };

  const closeTrackModal = () => {
    setSelectedTrack(null);
    setSelectedSongmid(null);
    window.history.pushState({}, "", "/offline-library");
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
      const res = await fetch(`/api/offline-library/tracks/${encodeURIComponent(selectedTrack.songmid)}/recache`, {
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
    if (!window.confirm(`确认删除离线缓存《${selectedTrack.songname}》吗？`)) return;

    setBusy("delete");
    try {
      const res = await fetch(`/api/offline-library/tracks/${encodeURIComponent(selectedTrack.songmid)}`, {
        method: "DELETE",
      });
      const data: { error?: string; job?: CacheJobInfo } = await res.json();
      if (!res.ok || !data?.job?.id) throw new Error(data?.error || "删除缓存失败");

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
    if (!window.confirm(`确认删除选中的 ${selectedSongmids.length} 首离线缓存音乐吗？`)) return;

    setBusy("delete");
    try {
      const res = await fetch("/api/offline-library/tracks/bulk-delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ songmids: selectedSongmids }),
      });
      const data: { error?: string; job?: CacheJobInfo } = await res.json();
      if (!res.ok || !data?.job?.id) throw new Error(data?.error || "批量删除缓存失败");

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
    <div className="fixed inset-0 z-[100] flex flex-col bg-zinc-950 text-zinc-50 overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(16,185,129,0.14),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.08),transparent_25%)]" />

      <div className="relative flex-1 overflow-y-auto custom-scrollbar">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
          <div className="glass-panel mb-8 flex flex-col gap-4 rounded-[28px] px-5 py-4">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div className="flex items-center gap-4">
                <button
                  onClick={onClose}
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/70 transition-colors hover:border-emerald-500/30 hover:text-emerald-400"
                  title="返回大厅"
                >
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div>
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-emerald-400">
                    <Library className="h-4 w-4" />
                    Offline Library
                  </div>
                  <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">离线曲库</h1>
                  <p className="mt-1 text-sm text-zinc-400">
                    查看缓存统计，管理离线缓存，并直接播放离线音乐。
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
                    <div className="text-[11px] uppercase tracking-widest text-zinc-500">离线歌曲</div>
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
                    <div className="mt-1 text-sm text-zinc-400">重新读取离线缓存目录和统计信息。</div>
                  </button>

                  <div className="rounded-2xl border border-zinc-800/60 bg-zinc-950/70 px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-semibold text-zinc-200">最近缓存时间</div>
                      <div className="mt-1 text-sm text-zinc-500">{formatTime(stats?.latestCachedAt || "")}</div>
                    </div>
                    {stats?.cacheWritesPaused && (
                      <div className="text-right">
                        <div className="text-sm font-semibold text-amber-200">写入已暂停</div>
                        <div className="mt-1 text-xs text-amber-200/70">空间不足</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <section className="glass-card min-h-[640px] rounded-[28px] p-4 sm:p-5">
            <div className="mb-6 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">离线曲库列表</h2>
                <p className="mt-1 text-xs text-zinc-500">
                  {loading
                    ? "正在读取离线缓存..."
                    : `共 ${total} 首离线歌曲，当前第 ${page}/${totalPages} 页`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-xs text-zinc-500">已选 {selectedSongmids.length} 首</div>
                <button
                  onClick={() => void handleBulkDelete()}
                  disabled={busy !== null || selectedSongmids.length === 0}
                  className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-2 text-sm text-red-300 hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40 transition-all"
                >
                  批量删除
                </button>
              </div>
            </div>

            <div className="grid gap-3">
              {tracks.map((track) => (
                <OfflineTrackItem 
                  key={track.songmid} 
                  track={track} 
                  isSelected={selectedSongmids.includes(track.songmid)}
                  onToggleSelection={() => toggleTrackSelection(track.songmid)}
                  onSelect={() => selectTrack(track)}
                />
              ))}

              {!loading && tracks.length === 0 && (
                <div className="py-24 text-center">
                  <div className="w-16 h-16 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-800">
                    <Library className="w-8 h-8 text-zinc-700" />
                  </div>
                  <p className="text-sm text-zinc-500">当前还没有离线缓存音乐</p>
                </div>
              )}
            </div>

            {total > PAGE_SIZE && (
              <div className="mt-8 flex items-center justify-between rounded-2xl border border-zinc-800/60 bg-zinc-900/45 px-6 py-4">
                <div className="text-xs text-zinc-500 font-medium">每页 {PAGE_SIZE} 首，共 {totalPages} 页</div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1}
                    className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 hover:border-emerald-500/30 hover:text-emerald-300 disabled:opacity-40 transition-all"
                  >
                    上一页
                  </button>
                  <button
                    onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                    disabled={page >= totalPages}
                    className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 hover:border-emerald-500/30 hover:text-emerald-300 disabled:opacity-40 transition-all"
                  >
                    下一页
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>

      <OfflinePlayerModal
        track={selectedTrack}
        busy={busy}
        onClose={closeTrackModal}
        onRecache={handleRecache}
        onDelete={handleDelete}
      />
    </div>
  );
}
