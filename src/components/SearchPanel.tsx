import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Plus, Search } from 'lucide-react';
import { useStore } from '../store';

export default function SearchPanel() {
    const { addSong, room } = useStore();
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(false);
    const [searchType, setSearchType] = useState<'song' | 'qq'>('song');
    const [playlists, setPlaylists] = useState<any[]>([]);
    const [selectedPlaylist, setSelectedPlaylist] = useState<string | null>(null);

    const handleSearch = async (e?: React.FormEvent | null, newPage = 1) => {
        if (e) e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        if (newPage === 1) {
            setResults([]);
            setPlaylists([]);
            setSelectedPlaylist(null);
        }

        try {
            if (searchType === 'song') {
                const res = await fetch(`/api/qqmusic/search?key=${encodeURIComponent(query)}&pageNo=${newPage}&pageSize=20`);
                const data = await res.json();
                const list = data.list || data.data?.list || [];
                if (newPage === 1) {
                    setResults(list);
                } else {
                    setResults(prev => [...prev, ...list]);
                }
                setHasMore(list.length === 20);
                setPage(newPage);
            } else {
                const res = await fetch(`/api/qqmusic/user/songlist?id=${encodeURIComponent(query)}`);
                const data = await res.json();
                if (data.list) {
                    setPlaylists(data.list);
                }
            }
        } catch (err) {
            console.error('[SearchPanel] 搜索失败:', err);
        }
        setLoading(false);
    };

    const loadPlaylist = async (tid: string) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/qqmusic/songlist?id=${tid}&roomId=${room?.id}`);
            const data = await res.json();
            const list = data.songlist || data.data?.songlist || [];
            setSelectedPlaylist(tid);
            setResults(list);
            setHasMore(false);
        } catch (err) {
            console.error('[SearchPanel] 加载歌单失败:', err);
        }
        setLoading(false);
    };

    return (
        <div className="h-1/2 border-b border-zinc-800/50 flex flex-col">
            <div className="p-4 border-b border-zinc-800/50 space-y-3">
                <div className="flex gap-2">
                    <button
                        onClick={() => { setSearchType('song'); setResults([]); setPlaylists([]); }}
                        className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${searchType === 'song' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800'}`}
                    >
                        搜歌曲
                    </button>
                    <button
                        onClick={() => { setSearchType('qq'); setResults([]); setPlaylists([]); }}
                        className={`flex-1 text-xs py-1.5 rounded-md transition-colors ${searchType === 'qq' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800'}`}
                    >
                        搜QQ歌单
                    </button>
                </div>
                <form onSubmit={(e) => handleSearch(e, 1)} className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                    <input
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        placeholder={searchType === 'song' ? "搜索 QQ 音乐..." : "输入 QQ 号..."}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                    />
                </form>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {searchType === 'qq' && !selectedPlaylist && playlists.length > 0 && (
                    <AnimatePresence>
                        {playlists.map((pl: any) => (
                            <motion.div
                                key={pl.tid || pl.dirid}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                onClick={() => loadPlaylist(pl.tid)}
                                className="flex items-center gap-3 p-2 hover:bg-zinc-800/50 rounded-lg cursor-pointer group"
                            >
                                {pl.diss_cover ? (
                                    <img src={pl.diss_cover} alt="" className="w-10 h-10 rounded-md object-cover" referrerPolicy="no-referrer" />
                                ) : (
                                    <div className="w-10 h-10 rounded-md bg-zinc-800 flex items-center justify-center">
                                        <Music className="w-5 h-5 text-zinc-500" />
                                    </div>
                                )}
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-medium truncate">{pl.diss_name}</div>
                                    <div className="text-xs text-zinc-500">{pl.song_cnt} 首歌曲</div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}

                {(searchType === 'song' || selectedPlaylist) && (
                    <>
                        {selectedPlaylist && (
                            <button
                                onClick={() => { setSelectedPlaylist(null); setResults([]); }}
                                className="text-xs text-zinc-400 hover:text-zinc-200 mb-2 px-2 flex items-center gap-1"
                            >
                                ← 返回歌单列表
                            </button>
                        )}
                        <AnimatePresence>
                            {results.map((song: any, idx) => (
                                <motion.div
                                    key={`${song.songmid}-${idx}`}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center justify-between p-2 hover:bg-zinc-800/50 rounded-lg group"
                                >
                                    <div className="min-w-0 flex-1 pr-4">
                                        <div className="text-sm font-medium truncate">{song.songname}</div>
                                        <div className="text-xs text-zinc-500 truncate">{Array.isArray(song.singer) ? song.singer.map((s: any) => s.name).join(', ') : song.singer}</div>
                                    </div>
                                    <button
                                        onClick={() => addSong(song)}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 bg-emerald-500/10 text-emerald-400 rounded-md hover:bg-emerald-500/20 transition-all shrink-0"
                                    >
                                        <Plus className="w-4 h-4" />
                                    </button>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        {hasMore && !loading && (
                            <button
                                onClick={() => handleSearch(null, page + 1)}
                                className="w-full py-2 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50 rounded-lg transition-colors mt-2"
                            >
                                加载更多
                            </button>
                        )}
                        {loading && (
                            <div className="text-center text-zinc-500 text-sm py-4">加载中...</div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
