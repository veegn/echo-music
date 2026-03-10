import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, SkipForward, Settings, Play, Pause } from 'lucide-react';
import { useStore } from '../store';
import Lyrics from './Lyrics';
import { CookieDialog } from './Dialogs';

function formatSinger(singer: unknown): string {
    if (Array.isArray(singer)) {
        return singer.map((s: any) => s.name).join(' / ');
    }
    if (typeof singer === 'string') {
        return singer;
    }
    return '';
}
const COOKIE_STORAGE_KEY = 'casebuy_music_vip_cookie';

export default function Player({ isHost }: { isHost: boolean }) {
    const { room, skipSong, syncPlayer, showToast } = useStore();
    const [showCookieDialog, setShowCookieDialog] = useState(false);
    const [audioUrl, setAudioUrl] = useState('');
    const [localCurrentTime, setLocalCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [songLoading, setSongLoading] = useState(false);
    const [autoPlayFailed, setAutoPlayFailed] = useState(false);
    const audioRef = useRef<HTMLAudioElement>(null);
    const lastSyncRef = useRef(0);


    // Initial state setup from room
    useEffect(() => {
        if (room) {
            setLocalCurrentTime(room.currentTime);
        }
    }, [room?.currentTime]);

    useEffect(() => {
        if (room?.currentSong) {
            setSongLoading(true);
            fetchAudioUrl(room.currentSong.songmid);
        } else {
            setAudioUrl('');
            setSongLoading(false);
            setAutoPlayFailed(false);
        }
    }, [room?.currentSong?.songmid]);

    const fetchAudioUrl = async (songmid: string) => {
        try {
            const res = await fetch(`/api/qqmusic/song/url?id=${songmid}&roomId=${room?.id}`);
            const data = await res.json();
            let url = '';

            // 调试用：记录原始返回数据
            console.log('[Player] API Raw Data:', data);

            if (typeof data === 'string' && data.startsWith('http')) {
                // 1. 直连字符串格式
                url = data;
            } else if (data && typeof data === 'object') {
                // 2. 检查各种对象嵌套格式
                if (data.data) {
                    if (typeof data.data === 'string' && data.data.startsWith('http')) {
                        url = data.data;
                    } else if (Array.isArray(data.data)) {
                        url = data.data[0];
                    } else if (typeof data.data === 'object') {
                        url = data.data[songmid];
                    }
                }

                // 3. 如果还没找到，尝试直接在根对象找对应 mid
                if (!url) {
                    url = data[songmid];
                }

                // 4. 通用降级方案：寻找包含 http 的第一个字符串值
                if (!url) {
                    const findFirstHttp = (obj: any): string | null => {
                        for (const key in obj) {
                            if (typeof obj[key] === 'string' && obj[key].startsWith('http')) return obj[key];
                            if (typeof obj[key] === 'object' && obj[key] !== null) {
                                const sub = findFirstHttp(obj[key]);
                                if (sub) return sub;
                            }
                        }
                        return null;
                    };
                    const found = findFirstHttp(data);
                    if (found) url = found;
                }
            } else if (Array.isArray(data)) {
                // 5. 数组格式响应
                const first = data[0];
                if (typeof first === 'string' && first.startsWith('http')) {
                    url = first;
                } else if (first && typeof first === 'object') {
                    url = first.url || first.purl || first[songmid];
                }
            }

            // 清理 URL (移除换行符及两端空格)，并且强制 HTTPS 避免 Mixed Content 报错
            if (url && typeof url === 'string') {
                url = url.trim().replace(/[\r\n]/g, '').replace(/^http:\/\//i, 'https://');
            }

            if (url && url.length > 10) {
                setAudioUrl(url);
                console.log('[Player] 播放链接获取成功:', url.substring(0, 50) + '...');
            } else {
                let errorMsg = '该歌曲可能需要 VIP 或版权限制，无法播放。';
                if (!room?.hasCookie) errorMsg = '未连接 VIP，无法播放加密或高品质歌曲。';
                throw new Error(errorMsg);
            }
            setSongLoading(false);
        } catch (e: any) {
            console.error('[Player] 播放失败:', e.message);
            showToast(e.message || '播放失败', 'error');
            setSongLoading(false);
            if (isHost) setTimeout(() => skipSong(true), 3000);
        }
    };



    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setLocalCurrentTime(audioRef.current.currentTime);
        }

        if (isHost && audioRef.current) {
            const now = Date.now();
            if (now - lastSyncRef.current > 2000) {
                syncPlayer(audioRef.current.currentTime, !audioRef.current.paused);
                lastSyncRef.current = now;
            }
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const togglePlay = () => {
        if (!isHost) return;
        if (audioRef.current) {
            if (audioRef.current.paused) {
                audioRef.current.play();
            } else {
                audioRef.current.pause();
            }
        }
    };

    const handlePlayPause = () => {
        if (isHost && audioRef.current) {
            syncPlayer(audioRef.current.currentTime, !audioRef.current.paused);
        }
    };



    useEffect(() => {
        if (!isHost && audioRef.current && room) {
            const diff = Math.abs(audioRef.current.currentTime - room.currentTime);
            if (diff > 2) {
                audioRef.current.currentTime = room.currentTime;
            }
            if (room.isPlaying && audioRef.current.paused) {
                audioRef.current.play().then(() => {
                    setAutoPlayFailed(false);
                }).catch(err => {
                    console.error('[Player] 自动播放同步失败:', err);
                    setAutoPlayFailed(true);
                });
            } else if (!room.isPlaying && !audioRef.current.paused) {
                audioRef.current.pause();
                setAutoPlayFailed(false);
            }
        }
    }, [room?.currentTime, room?.isPlaying, isHost]);

    useEffect(() => {
        if (audioRef.current && room?.currentSong && isHost) {
            setSongLoading(true);
            const playPromise = audioRef.current.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    setSongLoading(false);
                    // 自动播放成功
                    setAutoPlayFailed(false);
                }).catch(err => {
                    setSongLoading(false);
                    console.error('[Player] 主播自动播放失败:', err);
                    setAutoPlayFailed(true);
                    showToast('自动播放被浏览器拦截，请点击手动播放', 'error');
                });
            }
        }
    }, [audioUrl, isHost, room?.currentSong]);

    return (
        <div className="w-full h-full relative z-10 flex flex-col items-center justify-center min-h-[500px]">
            {/* Animated Dynamic Background */}
            <div className={`absolute -inset-40 pointer-events-none -z-10 transition-opacity duration-1000 ${room?.isPlaying ? 'opacity-100' : 'opacity-0'} overflow-hidden`}>
                <motion.div
                    animate={room?.isPlaying ? {
                        scale: [1, 1.4, 0.9, 1.3, 1],
                        opacity: [0.4, 0.7, 0.4, 0.8, 0.4],
                        rotate: [0, 90, 180, 270, 360]
                    } : { scale: 1, opacity: 0, rotate: 0 }}
                    transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-1/2 left-1/4 w-[500px] h-[500px] -translate-y-1/2 bg-emerald-500/30 rounded-full mix-blend-screen filter blur-[120px]"
                />
                <motion.div
                    animate={room?.isPlaying ? {
                        scale: [1, 1.5, 1, 1.4, 1],
                        opacity: [0.3, 0.6, 0.3, 0.7, 0.3],
                        rotate: [360, 270, 180, 90, 0]
                    } : { scale: 1, opacity: 0, rotate: 0 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-1/3 left-1/2 w-[600px] h-[600px] -translate-y-1/2 bg-blue-500/20 rounded-full mix-blend-screen filter blur-[150px]"
                />
                <motion.div
                    animate={room?.isPlaying ? {
                        scale: [0.8, 1.2, 0.8],
                        opacity: [0.2, 0.5, 0.2],
                    } : { scale: 1, opacity: 0 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute top-1/2 left-1/2 w-[400px] h-[400px] -translate-x-1/2 -translate-y-1/2 bg-purple-500/20 rounded-full mix-blend-screen filter blur-[100px]"
                />
            </div>

            {/* Main Player Area */}
            <div className="w-full max-w-5xl flex flex-col items-center gap-8 relative z-10">
                {/* AutoPlay Blocked Overlay Handler */}
                <AnimatePresence>
                    {autoPlayFailed && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md rounded-3xl cursor-pointer shadow-2xl"
                            onClick={() => {
                                if (audioRef.current) {
                                    audioRef.current.play()
                                        .then(() => setAutoPlayFailed(false))
                                        .catch(e => console.error('手动恢复播放失败:', e));
                                }
                            }}
                        >
                            <div className="flex flex-col items-center bg-zinc-900/90 border border-emerald-500/50 p-6 rounded-2xl">
                                <Play className="w-12 h-12 text-emerald-400 mb-4 animate-pulse" />
                                <p className="text-white font-bold text-lg">点击此处允许音乐播放</p>
                                <p className="text-zinc-400 text-sm mt-2">浏览器策略限制了自动播放，需手动授权一次</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Horizontal Layout for Controls and Album Art - Fixed height on desktop to prevent shift */}
                <div className="w-full flex flex-col md:flex-row items-center md:items-stretch bg-zinc-900/60 backdrop-blur-xl border border-zinc-800/50 rounded-3xl overflow-hidden shadow-2xl md:h-[320px]">

                    {/* Left: Controls & Info */}
                    <div className="flex-1 p-6 md:p-8 flex flex-col justify-between w-full h-full">
                        {/* Audio Element Hidden */}
                        {audioUrl && (
                            <audio
                                ref={audioRef}
                                src={audioUrl}
                                onTimeUpdate={handleTimeUpdate}
                                onLoadedMetadata={handleLoadedMetadata}
                                onPlay={handlePlayPause}
                                onPause={handlePlayPause}
                                onEnded={() => isHost && skipSong(true)}
                                className="hidden"
                            />
                        )}

                        {/* Info Section - Min height to keep layout stable */}
                        <div className="mb-6 mt-2 md:mt-0 min-h-[80px] flex flex-col justify-center">
                            <h2 className="text-3xl font-bold mb-2 tracking-tight text-white line-clamp-1 leading-tight">
                                {room?.currentSong ? room.currentSong.songname : '尚未开始播放'}
                            </h2>
                            <p className="text-zinc-400 text-sm font-medium line-clamp-2">
                                {room?.currentSong
                                    ? formatSinger(room.currentSong.singer)
                                    : '快去右侧搜索 / 播放列表中添加好歌吧'}
                            </p>
                        </div>

                        {/* Progress and Controls Area */}
                        <div>
                            {/* Progress Bar & Time */}
                            <div className="flex items-center gap-3 mb-6">
                                <span className="text-xs text-zinc-500 font-mono w-10 text-right shrink-0">
                                    {Math.floor(localCurrentTime / 60)}:{(Math.floor(localCurrentTime) % 60).toString().padStart(2, '0')}
                                </span>
                                <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden relative cursor-pointer"
                                    onClick={(e) => {
                                        if (isHost && audioRef.current && duration) {
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const pos = (e.clientX - rect.left) / rect.width;
                                            audioRef.current.currentTime = pos * duration;
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

                            {/* Playback Controls & Settings */}
                            <div className="flex items-center justify-between">
                                {/* Main Left-aligned Controls */}
                                <div className="flex items-center gap-6">
                                    <button
                                        onClick={togglePlay}
                                        disabled={!isHost || !room?.currentSong}
                                        className="text-zinc-300 hover:text-white disabled:opacity-30 transition-all bg-transparent border-0 relative flex items-center justify-center w-5 h-5 active:scale-75 cursor-pointer"
                                        title={room?.isPlaying ? "暂停" : "播放"}
                                    >
                                        <AnimatePresence mode="wait" initial={false}>
                                            <motion.div
                                                key={room?.isPlaying ? "pause" : "play"}
                                                initial={{ opacity: 0, scale: 0.5, rotate: -90 }}
                                                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                                                exit={{ opacity: 0, scale: 0.5, rotate: 90 }}
                                                transition={{ duration: 0.15, ease: "easeInOut" }}
                                                className="absolute inset-0 flex items-center justify-center cursor-pointer"
                                            >
                                                {room?.isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                                            </motion.div>
                                        </AnimatePresence>
                                    </button>
                                    <button
                                        onClick={() => skipSong()}
                                        disabled={!isHost || !room?.currentSong}
                                        title="下一首 / 切歌"
                                        className="text-zinc-300 hover:text-white disabled:opacity-30 transition-all bg-transparent border-0 active:scale-75 cursor-pointer flex items-center justify-center"
                                    >
                                        <SkipForward className="w-5 h-5 fill-current" />
                                    </button>
                                </div>

                                {/* Host Settings (VIP Button) */}
                                {isHost ? (
                                    <button
                                        onClick={() => setShowCookieDialog(true)}
                                        className={`shrink-0 flex items-center gap-1.5 px-2 py-1 text-xs font-medium cursor-pointer transition-colors bg-transparent border-0 ${room?.hasCookie
                                            ? 'text-emerald-500/80 hover:text-emerald-400'
                                            : 'text-zinc-500 hover:text-zinc-300'
                                            }`}
                                    >
                                        <Settings className="w-3.5 h-3.5" />
                                        <span>
                                            {room?.hasCookie ? (room?.hostQQId ? `VIP (QQ: ${room.hostQQId})` : 'VIP 已连接') : '连接 VIP'}
                                        </span>
                                    </button>
                                ) : (
                                    <div />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right: Album Art - Match fixed container height */}
                    <motion.div
                        className="w-full md:w-72 lg:w-80 h-64 md:h-full shrink-0 bg-zinc-950 relative overflow-hidden flex-none"
                        animate={{ opacity: room?.isPlaying ? 1 : 0.9 }}
                    >
                        {room?.currentSong ? (
                            <img
                                src={`https://y.qq.com/music/photo_new/T002R300x300M000${room.currentSong.albummid || room.currentSong.album?.mid}.jpg`}
                                alt="专辑封面"
                                className="w-full h-full object-cover transition-transform duration-1000"
                                style={{ transform: room?.isPlaying ? 'scale(1.05)' : 'scale(1)' }}
                                onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/music/300/300?blur=4'; }}
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

                {/* Lyrics Section - Fixed Height to prevent layout shift */}
                <div className="w-full max-w-2xl px-4 text-center h-48 flex flex-col justify-center">
                    {room?.currentSong ? (
                        <Lyrics songmid={room.currentSong.songmid} currentTime={localCurrentTime} />
                    ) : (
                        <p className="text-zinc-600 text-sm italic">等待播放...</p>
                    )}
                </div>
            </div>

            <CookieDialog
                isOpen={showCookieDialog}
                onClose={() => setShowCookieDialog(false)}
            />
        </div>
    );
}
