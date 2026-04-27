import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Compass,
  ListMusic,
  Loader2,
  Plus,
  Radio,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { useStore } from '../store';

type TabType = 'discovery' | 'radio';

function formatSinger(singer: unknown): string {
  if (Array.isArray(singer)) {
    return singer.map((s: any) => s.name || s).join(', ');
  }
  if (typeof singer === 'string') return singer;
  return '未知歌手';
}

function firstArray<T = any>(...candidates: any[]): T[] {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

function extractPlaylistEntries(payload: any): any[] {
  return firstArray(
    payload?.list,
    payload?.data?.list,
    payload?.data?.response?.data?.playlists,
    payload?.data?.data?.playlists,
    payload?.response?.data?.playlists,
    payload,
  );
}

function normalizePlaylistEntry(entry: any) {
  const subtitle = String(entry?.subtitle || '');
  const subtitleMatch = subtitle.match(/\d+/);
  return {
    ...entry,
    playlistId: String(entry?.dissid || entry?.tid || entry?.dirid || ''),
    playlistName: entry?.title || entry?.diss_name || entry?.dissname || '未命名歌单',
    playlistCover: entry?.picurl || entry?.diss_cover || entry?.imgurl || '',
    playlistSongCount: Number(entry?.song_cnt || entry?.songnum || subtitleMatch?.[0] || 0),
  };
}

function extractRadioStations(payload: any): any[] {
  return firstArray(
    payload?.stations,
    payload?.data?.stations,
    payload?.data?.data?.data?.groupList?.flatMap((group: any) => group?.radioList || []),
    payload?.data?.data?.groupList?.flatMap((group: any) => group?.radioList || []),
    payload?.data?.groupList?.flatMap((group: any) => group?.radioList || []),
  );
}

function extractRadioTracks(payload: any): any[] {
  return firstArray(
    payload?.tracks,
    payload?.data?.tracks,
    payload?.data?.songlist,
    payload?.songlist,
    payload?.data?.new_song?.data?.songlist,
    payload?.data?.data?.tracks,
    payload?.data?.data?.songlist,
    payload?.data,
  );
}

function extractPlaylistSongs(payload: any): any[] {
  return firstArray(
    payload?.cdlist?.[0]?.songlist,
    payload?.data?.cdlist?.[0]?.songlist,
    payload?.data?.data?.cdlist?.[0]?.songlist,
    payload?.songlist,
    payload?.data?.songlist,
    payload?.data?.data?.songlist,
    payload?.tracks,
    payload?.data?.tracks,
    payload?.data?.data?.tracks,
  );
}

function normalizeTrack(entry: any) {
  const singer =
    entry?.singer ||
    entry?.ar ||
    entry?.artists ||
    entry?.artist ||
    entry?.singer_name ||
    entry?.artist_name ||
    '未知歌手';

  return {
    ...entry,
    id: entry?.id || entry?.songid || entry?.songmid || entry?.mid || '',
    songmid: entry?.songmid || entry?.mid || entry?.strMediaMid || '',
    songname:
      entry?.songname ||
      entry?.name ||
      entry?.title ||
      entry?.songTitle ||
      entry?.songInfo?.name ||
      entry?.songInfo?.title ||
      '',
    singer,
    albummid:
      entry?.albummid ||
      entry?.album?.mid ||
      entry?.albumMid ||
      entry?.songInfo?.album?.mid ||
      '',
  };
}

export default function MusicPanel({ isHost }: { isHost: boolean }) {
  const { room, addSong, playSongs, reorderQueue, removeSong, showToast } = useStore();

  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showQueue, setShowQueue] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('discovery');

  const [searchLoading, setSearchLoading] = useState(false);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [radioLoading, setRadioLoading] = useState(false);

  const [playlists, setPlaylists] = useState<any[]>([]);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [playlistSongs, setPlaylistSongs] = useState<any[]>([]);
  const [localTracks, setLocalTracks] = useState<any[]>([]);

  const [radioSongs, setRadioSongs] = useState<any[]>([]);
  const [radioStations, setRadioStations] = useState<any[]>([]);
  const [selectedRadioId, setSelectedRadioId] = useState<string>('99');
  const [selectedRadioName, setSelectedRadioName] = useState<string>('私人电台');

  useEffect(() => {
    setPlaylists([]);
    setSelectedPlaylistId(null);
    setPlaylistSongs([]);
    setLocalTracks([]);
    setRadioSongs([]);
    setRadioStations([]);
    setSelectedRadioId('99');
    setSelectedRadioName('私人电台');
  }, [room?.id]);

  useEffect(() => {
    if (activeTab !== 'discovery') return;
    if (room?.hasCookie && room?.hostQQId) {
      void fetchHostPlaylists();
      return;
    }
    if (room && !room.hasCookie) {
      void loadLocalTracks();
    }
  }, [activeTab, room?.hostQQId, room?.hasCookie, room?.id]);

  useEffect(() => {
    if (activeTab === 'radio' && room?.hasCookie) {
      void loadGuessYouLikeRadio();
    }
  }, [activeTab, room?.id, room?.hasCookie]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setSearchLoading(true);
    setSearchResults([]);
    try {
      const res = await fetch(`/api/qqmusic/search?key=${encodeURIComponent(query)}&pageNo=1&pageSize=30`);
      const data = await res.json();
      const list = data.list || data.data?.list || [];
      setSearchResults(list);
    } catch (err) {
      console.error('[MusicPanel] search failed:', err);
      showToast('搜索失败', 'error');
    }
    setSearchLoading(false);
  };

  const handleAddSong = (song: any) => {
    addSong(song);
  };

  const fetchHostPlaylists = async () => {
    if (!room?.hostQQId || !room?.id || !room?.hasCookie) {
      setPlaylists([]);
      return;
    }

    setDiscoveryLoading(true);
    try {
      const res = await fetch(
        `/api/qqmusic/user/songlist?id=${encodeURIComponent(room.hostQQId)}&roomId=${encodeURIComponent(room.id)}`,
      );
      const data = await res.json();
      if (!res.ok) {
        showToast(data?.error || '获取房主歌单失败', 'error');
        setPlaylists([]);
      } else {
        setPlaylists(extractPlaylistEntries(data).map(normalizePlaylistEntry));
      }
    } catch (err) {
      console.error('[MusicPanel] failed to fetch playlists:', err);
      showToast('获取房主歌单失败', 'error');
      setPlaylists([]);
    }
    setDiscoveryLoading(false);
  };

  const loadLocalTracks = async () => {
    setDiscoveryLoading(true);
    try {
      const res = await fetch('/api/offline-library/tracks?page=1&pageSize=50');
      const data = await res.json();
      const list = Array.isArray(data?.list) ? data.list : [];
      setLocalTracks(list.map((track: any) => ({
        ...track,
        id: track.songmid || track.id,
        songmid: track.songmid,
        songname: track.songname,
        singer: track.singer,
        albumname: track.albumname,
        albummid: track.albummid || '',
        playUrl: track.audioUrl,
        playQuality: 'local-cache',
      })));
    } catch (err) {
      console.error('[MusicPanel] failed to load local cached tracks:', err);
      showToast('加载本地缓存音乐失败', 'error');
      setLocalTracks([]);
    }
    setDiscoveryLoading(false);
  };

  const loadPlaylistSongs = async (playlistId: string) => {
    setDiscoveryLoading(true);
    setPlaylistSongs([]);
    setSelectedPlaylistId(playlistId);
    try {
      const res = await fetch(`/api/qqmusic/songlist?id=${playlistId}&roomId=${room?.id}`);
      const data = await res.json();
      setPlaylistSongs(extractPlaylistSongs(data).map(normalizeTrack));
    } catch (err) {
      console.error('[MusicPanel] failed to load playlist songs:', err);
      showToast('加载歌单失败', 'error');
      setSelectedPlaylistId(null);
    }
    setDiscoveryLoading(false);
  };

  const handleRandomLocalPlay = () => {
    if (localTracks.length === 0) {
      showToast('当前没有可播放的本地缓存音乐', 'info');
      return;
    }
    const randomTrack = localTracks[Math.floor(Math.random() * localTracks.length)];
    addSong(randomTrack);
    showToast(`已随机点播本地缓存：${randomTrack.songname}`, 'success');
  };

  const loadGuessYouLikeRadio = async () => {
    await loadRadioById('99', '私人电台');
  };

  const loadRadioById = async (radioId: string, radioName: string) => {
    if (!room?.hasCookie) {
      setRadioSongs([]);
      setRadioStations([]);
      return;
    }

    setRadioLoading(true);
    setRadioSongs([]);
    setRadioStations([]);
    setSelectedRadioId(radioId);
    setSelectedRadioName(radioName);

    try {
      const res = await fetch(`/api/qqmusic/radio/songs?id=${encodeURIComponent(radioId)}&roomId=${room?.id}`);
      const data = await res.json();
      const normalizedList = extractRadioTracks(data).map((track: any) => ({
        ...track,
        songmid: track.songmid || track.mid,
        songname: track.songname || track.name || track.title,
        singer: track.singer || track.singer_name || track.artist_name || '未知歌手',
      }));
      setRadioSongs(normalizedList);
      setRadioStations(Array.isArray(extractRadioStations(data)) ? extractRadioStations(data) : []);

      if (!res.ok) {
        showToast(data?.error || '加载电台失败', 'error');
      } else if (normalizedList.length === 0 && radioId !== '99') {
        showToast('当前项目暂不支持直接拉取该电台的曲目列表', 'info');
      }
    } catch (err) {
      console.error('[MusicPanel] failed to load radio:', err);
      showToast('加载电台失败', 'error');
    }

    setRadioLoading(false);
  };

  const renderTrackList = (tracks: any[], showPlayAll = false) => (
    <div className="space-y-1">
      {showPlayAll && tracks.length > 0 && isHost && (
        <button
          onClick={() => playSongs(tracks)}
          className="w-full py-2.5 mb-2 btn-primary text-xs flex items-center justify-center gap-2"
        >
          <Radio className="w-4 h-4" />
          一键播放全部
        </button>
      )}
      {tracks.map((song) => (
        <div key={song.songmid || song.id} className="group flex items-center justify-between p-3 list-item-hover">
          <div className="flex flex-col min-w-0 flex-1 pr-4">
            <span className="text-sm font-medium text-zinc-100 truncate">{song.songname}</span>
            <span className="text-xs text-zinc-500 truncate">{formatSinger(song.singer)}</span>
          </div>
          <button
            onClick={() => handleAddSong(song)}
            className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 hover:border hover:border-emerald-500/30 transition-all shrink-0 md:opacity-0 md:group-hover:opacity-100"
            title="点歌"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      ))}
    </div>
  );

  const renderDiscovery = () => {
    if (selectedPlaylistId) {
      return (
        <div className="space-y-4">
          <button
            onClick={() => {
              setSelectedPlaylistId(null);
              setPlaylistSongs([]);
            }}
            className="text-xs font-bold text-emerald-500 hover:text-emerald-400 mb-2 px-3 py-2 bg-emerald-500/10 rounded-lg flex items-center gap-2 transition-colors w-fit"
          >
            <ChevronRight className="w-4 h-4 rotate-180" /> 返回歌单
          </button>
          {discoveryLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-400" /></div>
          ) : (
            renderTrackList(playlistSongs, true)
          )}
        </div>
      );
    }

    if (!room?.hasCookie) {
      return (
        <div className="space-y-4">
          <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">本地缓存音乐</div>
          {discoveryLoading && localTracks.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-emerald-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : localTracks.length === 0 ? (
            <div className="text-center text-sm text-zinc-500 py-8">当前没有本地缓存音乐</div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3 rounded-2xl border border-emerald-500/15 bg-emerald-500/5 px-4 py-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-zinc-100">本地缓存音乐</div>
                  <div className="text-xs text-zinc-500">未设置 Cookie 时，房间将展示本地缓存音乐并支持随机播放</div>
                </div>
                <button
                  onClick={handleRandomLocalPlay}
                  className="shrink-0 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/25 transition-colors"
                >
                  随机播放
                </button>
              </div>
              {renderTrackList(localTracks)}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">房主歌单</div>
        {!room?.hostQQId ? (
          <div className="text-center text-sm text-amber-500/80 py-8 bg-amber-500/5 rounded-xl border border-amber-500/10">
            房主尚未绑定 QQ，无法查看歌单
          </div>
        ) : discoveryLoading && playlists.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-emerald-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : playlists.length === 0 ? (
          <div className="text-center text-sm text-zinc-500 py-8">当前列表为空</div>
        ) : (
          <div className="grid gap-3">
            {playlists.map((playlist) => (
              <div
                key={playlist.playlistId || Math.random()}
                onClick={() => loadPlaylistSongs(playlist.playlistId)}
                className="flex items-center gap-4 bg-zinc-900/60 hover:bg-zinc-800/80 p-3 rounded-2xl border border-zinc-800/50 hover:border-emerald-500/30 transition-all cursor-pointer group"
              >
                <img
                  src={playlist.playlistCover}
                  className="w-14 h-14 rounded-xl object-cover shadow-md group-hover:scale-105 transition-transform"
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/music/200/200?blur=4'; }}
                />
                <div className="flex flex-col flex-1 min-w-0">
                  <span className="text-sm font-semibold text-zinc-100 truncate group-hover:text-emerald-400 transition-colors">{playlist.playlistName}</span>
                  <span className="text-xs text-zinc-500 mt-1">{playlist.playlistSongCount || 0} 首歌曲</span>
                </div>
                <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderRadio = () => (
    <div className="space-y-4">
      <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center justify-between">
        <span>{selectedRadioName}</span>
        {room?.hasCookie && (
          <div className="flex items-center gap-2">
            {selectedRadioId !== '99' && (
              <button
                onClick={() => loadGuessYouLikeRadio()}
                className="text-[10px] bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded text-zinc-300 transition-colors"
              >
                返回电台
              </button>
            )}
            <button
              onClick={() => loadRadioById(selectedRadioId, selectedRadioName)}
              className="text-[10px] bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded text-zinc-300 transition-colors"
            >
              换一批
            </button>
          </div>
        )}
      </div>

      {!room?.hasCookie ? (
        <div className="text-center text-sm text-zinc-500 py-8">设置 Cookie 后可使用 QQMusic 电台功能</div>
      ) : radioLoading && radioSongs.length === 0 ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-400" /></div>
      ) : radioSongs.length > 0 ? (
        renderTrackList(radioSongs, true)
      ) : radioStations.length > 0 ? (
        <div className="grid gap-3">
          {radioStations.map((station, index) => (
            <div
              key={[station.radioId || station.id || 'radio', station.groupName || 'group', station.radioName || station.name || 'station', index].join(':')}
              onClick={() => loadRadioById(String(station.radioId || station.id || ''), station.radioName || station.name || '电台')}
              className="flex items-center gap-4 bg-zinc-900/60 p-3 rounded-2xl border border-zinc-800/50 hover:bg-zinc-800/80 hover:border-emerald-500/30 transition-all cursor-pointer group"
            >
              <img
                src={station.radioImg || 'https://picsum.photos/seed/radio/200/200?blur=4'}
                className="w-14 h-14 rounded-xl object-cover shadow-md"
                onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/radio/200/200?blur=4'; }}
              />
              <div className="flex flex-col flex-1 min-w-0">
                <span className="text-sm font-semibold text-zinc-100 truncate group-hover:text-emerald-400 transition-colors">{station.radioName || station.name}</span>
                <span className="text-xs text-zinc-500 mt-1 truncate">{station.groupName || '推荐电台'}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400 transition-colors shrink-0" />
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center text-sm text-zinc-500 py-8">暂无可展示的电台内容</div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden bg-zinc-950 relative">
      <div className="shrink-0 p-4 border-b border-zinc-800/50 bg-zinc-900/30">
        <form onSubmit={handleSearch} className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索歌曲或专辑..."
            className="input-dark w-full pl-9 pr-8"
          />
          {query.trim() && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </form>
      </div>

      {!query.trim() && !showQueue && (
        <div className="shrink-0 flex px-2 py-2 border-b border-zinc-800/50 bg-zinc-900/10">
          <button
            onClick={() => setActiveTab('discovery')}
            className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'discovery' ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
          >
            <Compass className="w-4 h-4" />
            {room?.hasCookie ? '歌单' : '本地缓存'}
          </button>
          <button
            onClick={() => { setActiveTab('radio'); setSelectedPlaylistId(null); }}
            className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'radio' ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
          >
            <Radio className="w-4 h-4" />
            电台
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar pb-[calc(5.5rem_+_env(safe-area-inset-bottom))]">
        <AnimatePresence mode="wait">
          {showQueue ? (
            <motion.div key="queue" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="h-full">
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center justify-between">
                <span>播放队列 ({room?.queue.length || 0})</span>
              </div>
              {room?.queue.length === 0 ? (
                <div className="text-center text-zinc-500 text-sm py-8">队列为空</div>
              ) : (
                <div className="space-y-2">
                  {room?.queue.map((song, index) => (
                    <div key={song.id} className="flex items-center gap-3 p-2 bg-zinc-900/40 hover:bg-zinc-800/60 rounded-xl border border-transparent hover:border-zinc-700/50 transition-all group">
                      <div className="w-6 text-center text-xs text-zinc-500 font-mono">{index + 1}</div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-zinc-100 truncate">{song.songname}</div>
                        <div className="text-xs text-zinc-500 truncate">{formatSinger(song.singer)}</div>
                      </div>
                      <div className="text-[10px] text-zinc-500 shrink-0 flex flex-col items-end gap-1">
                        <span>点歌人: {song.requestedBy}</span>
                        {isHost && (
                          <div className="flex items-center gap-1 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                            <button onClick={() => reorderQueue(index, Math.max(0, index - 1))} disabled={index === 0} className="p-1 hover:bg-zinc-700 rounded disabled:opacity-30">
                              <ArrowUp className="w-3 h-3" />
                            </button>
                            <button onClick={() => reorderQueue(index, Math.min(room.queue.length - 1, index + 1))} disabled={index === room.queue.length - 1} className="p-1 hover:bg-zinc-700 rounded disabled:opacity-30">
                              <ArrowDown className="w-3 h-3" />
                            </button>
                            <button onClick={() => removeSong(index)} className="p-1 hover:bg-red-500/20 text-red-400 rounded">
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          ) : query.trim() ? (
            <motion.div key="search" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-4">
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">搜索结果</div>
              {searchLoading && searchResults.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-emerald-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
              ) : searchResults.length === 0 ? (
                <div className="text-center text-sm text-zinc-500 py-8">无结果</div>
              ) : (
                renderTrackList(searchResults)
              )}
            </motion.div>
          ) : activeTab === 'discovery' ? (
            <motion.div key="discovery" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              {renderDiscovery()}
            </motion.div>
          ) : (
            <motion.div key="radio" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
              {renderRadio()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-zinc-900 p-4 pb-[calc(1rem_+_env(safe-area-inset-bottom))] border-t border-zinc-800/50 backdrop-blur-md z-10">
        <button
          onClick={() => setShowQueue(!showQueue)}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${showQueue ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-transparent'}`}
        >
          <div className="flex items-center gap-2 font-medium">
            <ListMusic className="w-5 h-5" />
            <span>当前播放队列</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 bg-zinc-950/50 rounded-full">{room?.queue.length || 0} 首歌曲</span>
            <ChevronRight className={`w-4 h-4 transition-transform ${showQueue ? 'rotate-90' : ''}`} />
          </div>
        </button>
      </div>
    </div>
  );
}
