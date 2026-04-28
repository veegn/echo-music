import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ChevronRight,
  Compass,
  ListMusic,
  Loader2,
  Radio,
} from 'lucide-react';
import { useStore } from '../store';
import { 
  formatSinger, 
  extractPlaylistEntries, 
  normalizePlaylistEntry,
  extractRadioStations,
  extractRadioTracks,
  extractPlaylistSongs,
  normalizeTrack
} from '../utils/music';
import SearchBar from './music/SearchBar';
import TrackList from './music/TrackList';
import QueueView from './music/QueueView';

type TabType = 'discovery' | 'radio';

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
            <TrackList 
              tracks={playlistSongs} 
              showPlayAll 
              isHost={isHost} 
              onAddSong={addSong} 
              onPlayAll={playSongs} 
            />
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
              <TrackList tracks={localTracks} onAddSong={addSong} />
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
        <TrackList 
          tracks={radioSongs} 
          showPlayAll 
          isHost={isHost} 
          onAddSong={addSong} 
          onPlayAll={playSongs} 
        />
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
      <SearchBar 
        query={query} 
        onQueryChange={setQuery} 
        onSearch={handleSearch} 
        onClear={() => setQuery('')} 
      />

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
            <QueueView 
              queue={room?.queue || []} 
              isHost={isHost} 
              onReorder={reorderQueue} 
              onRemove={removeSong} 
            />
          ) : query.trim() ? (
            <motion.div key="search" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-4">
              <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">搜索结果</div>
              {searchLoading && searchResults.length === 0 ? (
                <div className="flex items-center justify-center py-8 text-emerald-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
              ) : searchResults.length === 0 ? (
                <div className="text-center text-sm text-zinc-500 py-8">无结果</div>
              ) : (
                <TrackList tracks={searchResults} onAddSong={addSong} />
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
