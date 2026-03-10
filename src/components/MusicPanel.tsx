// src/components/MusicPanel.tsx
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Compass, Radio, ChevronRight, X, Loader2, ArrowUp, ArrowDown, Trash2, Plus, ListMusic } from 'lucide-react';
import { useStore } from '../store';

// 格式化歌手显示
function formatSinger(singer: unknown): string {
    if (Array.isArray(singer)) {
        return singer.map((s: any) => s.name || s).join(', ');
    }
    if (typeof singer === 'string') return singer;
    return '未知歌手';
}

type TabType = 'discovery' | 'radio' | 'search';

export default function MusicPanel({ isHost }: { isHost: boolean }) {
    const { room, addSong, playSongs, reorderQueue, removeSong } = useStore();

    // 搜索状态 (覆盖其他所有 Tab)
    const [query, setQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    // 独立控制队列界面是否显示
    const [showQueue, setShowQueue] = useState(false);

    // 选项卡状态
    const [activeTab, setActiveTab] = useState<TabType>('discovery');

    // ============= 搜索相关 =============
    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!query.trim()) {
            return;
        }
        setActiveTab('search');
        setLoading(true);
        setSearchResults([]);
        try {
            const res = await fetch(`/api/qqmusic/search?key=${encodeURIComponent(query)}&pageNo=1&pageSize=30`);
            const data = await res.json();
            const list = data.list || data.data?.list || [];
            setSearchResults(list);
        } catch (err) {
            console.error('[MusicPanel] 搜索失败:', err);
        }
        setLoading(false);
    };

    // 当点击加入队列后，提示点歌成功
    const handleAddSong = (s: any) => {
        addSong(s);
        // 不清空查询，也不切换 tab，保留搜索结果，让用户可以继续点歌
        // 但如果打开了队列视图，可以自动关闭它以便看到点播反馈，或者不管
    };

    // ============= Discovery: 当前账户下的歌单 (房主) =============
    const [playlists, setPlaylists] = useState<any[]>([]);
    const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
    const [playlistSongs, setPlaylistSongs] = useState<any[]>([]);

    useEffect(() => {
        if (activeTab === 'discovery' && room?.hostQQId && playlists.length === 0 && !loading) {
            fetchHostPlaylists();
        }
    }, [activeTab, room?.hostQQId]);

    const fetchHostPlaylists = async () => {
        if (!room?.hostQQId || !room?.id) return;
        setLoading(true);
        try {
            const res = await fetch(
                `/api/qqmusic/user/songlist?id=${encodeURIComponent(room.hostQQId)}&roomId=${encodeURIComponent(room.id)}`
            );
            const data = await res.json();
            if (data.list) setPlaylists(data.list);
            else if (Array.isArray(data)) setPlaylists(data);
        } catch (err) {
            console.error('[MusicPanel] 获取房主歌单失败:', err);
        }
        setLoading(false);
    };

    const loadPlaylistSongs = async (tid: string) => {
        setLoading(true);
        setPlaylistSongs([]);
        setSelectedPlaylistId(tid);
        try {
            const res = await fetch(`/api/qqmusic/songlist?id=${tid}&roomId=${room?.id}`);
            const data = await res.json();
            const list = data.songlist || data.data?.songlist || data.tracks || [];
            setPlaylistSongs(list);
        } catch (err) {
            console.error('[MusicPanel] 加载歌单详情失败:', err);
            setSelectedPlaylistId(null);
        }
        setLoading(false);
    };

    // ============= Radio: 猜你喜欢电台 =============
    const [radioSongs, setRadioSongs] = useState<any[]>([]);

    useEffect(() => {
        if (activeTab === 'radio' && radioSongs.length === 0 && !loading) {
            loadGuessYouLikeRadio();
        }
    }, [activeTab]);

    const loadGuessYouLikeRadio = async () => {
        setLoading(true);
        try {
            // 99 是"猜你喜欢"电台的 ID
            const res = await fetch(`/api/qqmusic/radio/songs?id=99&roomId=${room?.id}`);
            const data = await res.json();
            let list = data.tracks || data.data?.songlist || data.songlist || data.data || [];

            const normalizedList = Array.isArray(list) ? list.map((s: any) => ({
                ...s,
                songmid: s.songmid || s.mid,
                songname: s.songname || s.name || s.title,
                singer: s.singer || s.singer_name || s.artist_name || '未知歌手'
            })) : [];
            setRadioSongs(normalizedList);
        } catch (err) {
            console.error('[MusicPanel] 加载猜你喜欢电台失败:', err);
        }
        setLoading(false);
    };


    // ============= 渲染辅助 =============
    const renderTrackList = (tracks: any[], listName: string, showPlayAll = false) => {
        return (
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
                {tracks.map((s) => (
                    <div key={s.songmid || s.id} className="group flex items-center justify-between p-3 list-item-hover">
                        <div className="flex flex-col min-w-0 flex-1 pr-4">
                            <span className="text-sm font-medium text-zinc-100 truncate">{s.songname}</span>
                            <span className="text-xs text-zinc-500 truncate">{formatSinger(s.singer)}</span>
                        </div>
                        <button
                            onClick={() => handleAddSong(s)}
                            className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 hover:border hover:border-emerald-500/30 transition-all shrink-0 md:opacity-0 md:group-hover:opacity-100"
                            title="点歌"
                        >
                            <Plus className="w-4 h-4" />
                        </button>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full overflow-hidden bg-zinc-950 relative">
            {/* Top Search Bar */}
            <div className="shrink-0 p-4 border-b border-zinc-800/50 bg-zinc-900/30">
                <form onSubmit={handleSearch} className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onFocus={() => { if (query.trim()) setActiveTab('search'); }}
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

            {/* Navigation Tabs (Hidden if viewing search or queue) */}
            {!query.trim() && !showQueue && (
                <div className="shrink-0 flex px-2 py-2 border-b border-zinc-800/50 bg-zinc-900/10">
                    <button
                        onClick={() => setActiveTab('discovery')}
                        className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${activeTab === 'discovery' ? 'text-emerald-400 bg-emerald-500/10' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'}`}
                    >
                        <Compass className="w-4 h-4" />
                        歌单
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

            {/* Persistent Queue Toggle at Bottom or as a floated button */}
            {/* Actually, let's put Queue as a fixed bottom bar inside MusicPanel */}

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar pb-20">
                <AnimatePresence mode="wait">
                    {/* -------- Queue View -------- */}
                    {showQueue ? (
                        <motion.div key="queue" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="h-full">
                            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center justify-between">
                                <span>播放队列 ({room?.queue.length || 0})</span>
                            </div>
                            {room?.queue.length === 0 ? (
                                <div className="text-center text-zinc-500 text-sm py-8">队列为空</div>
                            ) : (
                                <div className="space-y-2">
                                    {room?.queue.map((song, i) => (
                                        <div key={song.id} className="flex items-center gap-3 p-2 bg-zinc-900/40 hover:bg-zinc-800/60 rounded-xl border border-transparent hover:border-zinc-700/50 transition-all group">
                                            <div className="w-6 text-center text-xs text-zinc-500 font-mono">{i + 1}</div>
                                            <div className="min-w-0 flex-1">
                                                <div className="text-sm font-medium text-zinc-100 truncate">{song.songname}</div>
                                                <div className="text-xs text-zinc-500 truncate">{formatSinger(song.singer)}</div>
                                            </div>
                                            <div className="text-[10px] text-zinc-500 shrink-0 flex flex-col items-end gap-1">
                                                <span>点歌人: {song.requestedBy}</span>
                                                {isHost && (
                                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => reorderQueue(i, Math.max(0, i - 1))} disabled={i === 0} className="p-1 hover:bg-zinc-700 rounded disabled:opacity-30">
                                                            <ArrowUp className="w-3 h-3" />
                                                        </button>
                                                        <button onClick={() => reorderQueue(i, Math.min(room.queue.length - 1, i + 1))} disabled={i === room.queue.length - 1} className="p-1 hover:bg-zinc-700 rounded disabled:opacity-30">
                                                            <ArrowDown className="w-3 h-3" />
                                                        </button>
                                                        <button onClick={() => removeSong(i)} className="p-1 hover:bg-red-500/20 text-red-400 rounded">
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
                        /* -------- Search Results -------- */
                        <motion.div key="search" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="space-y-4">
                            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">搜索结果</div>
                            {loading && searchResults.length === 0 ? (
                                <div className="flex items-center justify-center py-8 text-emerald-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
                            ) : searchResults.length === 0 ? (
                                <div className="text-center text-sm text-zinc-500 py-8">无结果</div>
                            ) : (
                                renderTrackList(searchResults, 'Search')
                            )}
                        </motion.div>
                    ) : activeTab === 'discovery' ? (
                        /* -------- Discovery: Host Playlists -------- */
                        <motion.div key="discovery" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                            {selectedPlaylistId ? (
                                <div className="space-y-4">
                                    <button
                                        onClick={() => { setSelectedPlaylistId(null); setPlaylistSongs([]); }}
                                        className="text-xs font-bold text-emerald-500 hover:text-emerald-400 mb-2 px-3 py-2 bg-emerald-500/10 rounded-lg flex items-center gap-2 transition-colors w-fit"
                                    >
                                        <ChevronRight className="w-4 h-4 rotate-180" /> 返回歌单
                                    </button>
                                    {loading ? (
                                        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-400" /></div>
                                    ) : (
                                        renderTrackList(playlistSongs, 'Playlist', true)
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">房主歌单</div>
                                    {!room?.hostQQId ? (
                                        <div className="text-center text-sm text-amber-500/80 py-8 bg-amber-500/5 rounded-xl border border-amber-500/10">
                                            房主尚未绑定 QQ，无法查看歌单
                                        </div>
                                    ) : loading && playlists.length === 0 ? (
                                        <div className="flex items-center justify-center py-8 text-emerald-400"><Loader2 className="w-6 h-6 animate-spin" /></div>
                                    ) : playlists.length === 0 ? (
                                        <div className="text-center text-sm text-zinc-500 py-8">当前列表为空</div>
                                    ) : (
                                        <div className="grid gap-3">
                                            {playlists.map((pl) => (
                                                <div
                                                    key={pl.tid || pl.dirid || pl.dissid || Math.random()}
                                                    onClick={() => loadPlaylistSongs(pl.tid || pl.dirid || pl.dissid)}
                                                    className="flex items-center gap-4 bg-zinc-900/60 hover:bg-zinc-800/80 p-3 rounded-2xl border border-zinc-800/50 hover:border-emerald-500/30 transition-all cursor-pointer group"
                                                >
                                                    <img
                                                        src={pl.diss_cover || pl.imgurl || pl.picurl}
                                                        className="w-14 h-14 rounded-xl object-cover shadow-md group-hover:scale-105 transition-transform"
                                                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/music/200/200?blur=4'; }}
                                                    />
                                                    <div className="flex flex-col flex-1 min-w-0">
                                                        <span className="text-sm font-semibold text-zinc-100 truncate group-hover:text-emerald-400 transition-colors">{pl.diss_name || pl.dissname}</span>
                                                        <span className="text-xs text-zinc-500 mt-1">
                                                            {pl.song_cnt || 0} 首歌曲
                                                        </span>
                                                    </div>
                                                    <ChevronRight className="w-5 h-5 text-zinc-600 group-hover:text-emerald-400 transition-colors" />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </motion.div>
                    ) : activeTab === 'radio' ? (
                        /* -------- Radio: Personalized Radio -------- */
                        <motion.div key="radio" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }}>
                            <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4 flex items-center justify-between">
                                <span>猜你喜欢</span>
                                <button
                                    onClick={loadGuessYouLikeRadio}
                                    className="text-[10px] bg-zinc-800 hover:bg-zinc-700 px-2 py-1 rounded text-zinc-300 transition-colors"
                                >
                                    换一批
                                </button>
                            </div>
                            {loading && radioSongs.length === 0 ? (
                                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-emerald-400" /></div>
                            ) : (
                                renderTrackList(radioSongs, 'Radio', true)
                            )}
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </div>

            {/* Persistent Queue Toggle Toolbar */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-zinc-900 border-t border-zinc-800/50 backdrop-blur-md z-10">
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
