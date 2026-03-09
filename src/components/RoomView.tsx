import React, { useState, useEffect } from 'react';
import { useStore } from '../store';
import { Users, MessageSquare, Search as SearchIcon, ListMusic, X, LogOut, Wifi, WifiOff, LoaderCircle } from 'lucide-react';
import ChatBox from './ChatBox';
import Player from './Player';
import SearchPanel from './SearchPanel';
import QueuePanel from './QueuePanel';
import { AnimatePresence, motion } from 'framer-motion';

export default function RoomView() {
    const { room, leaveRoom, userName, connectionState } = useStore();
    const isHost = room?.hostName === userName;

    // 防息屏机制 (Wake Lock)
    useEffect(() => {
        let wakeLock: any = null;
        const requestWakeLock = async () => {
            try {
                if ('wakeLock' in navigator) {
                    wakeLock = await (navigator as any).wakeLock.request('screen');
                }
            } catch (err) {
                console.warn(`Wake Lock request failed:`, err);
            }
        };

        requestWakeLock();

        const handleVisibilityChange = () => {
            if (wakeLock !== null && document.visibilityState === 'visible') {
                requestWakeLock();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            if (wakeLock !== null) {
                wakeLock.release().catch(() => { });
            }
        };
    }, []);

    // 面板显隐状态控制
    const [showLeftPanel, setShowLeftPanel] = useState(false); // 包含在线用户和聊天
    const [showRightPanel, setShowRightPanel] = useState(false); // 包含搜索和队列

    // 移动端当前激活的面板 (mobile view)
    const [activeMobileTab, setActiveMobileTab] = useState<'none' | 'chat' | 'users' | 'search' | 'queue'>('none');

    return (
        <div className="flex flex-col h-screen bg-zinc-950 text-zinc-50 overflow-hidden font-sans relative">
            {/* Top Header - Fixed & Highest z-index */}
            <header className="shrink-0 h-16 border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-md z-40 px-4 flex items-center justify-between shadow-sm">
                <div className="flex items-center gap-4 min-w-0">
                    <div className="flex flex-col flex-1 min-w-0">
                        <h2 className="font-bold text-lg truncate leading-tight">{room?.name}</h2>
                        <div className="flex items-center gap-2 text-xs text-zinc-400">
                            <span className="truncate max-w-[150px]">房主: {room?.hostName}</span>
                            {room?.hostQQId && (
                                <span className="text-emerald-400/80 flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded-full shrink-0">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    QQ: {room.hostQQId}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                    {/* Connection Status Indicator */}
                    <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded bg-zinc-900 border border-zinc-800">
                        {connectionState === 'connected' && <><Wifi className="w-3.5 h-3.5 text-emerald-400" /> <span className="text-zinc-400">在线</span></>}
                        {connectionState === 'connecting' && <><LoaderCircle className="w-3.5 h-3.5 text-amber-400 animate-spin" /> <span className="text-amber-400">重连中...</span></>}
                        {connectionState === 'disconnected' && <><WifiOff className="w-3.5 h-3.5 text-red-400" /> <span className="text-red-400">离线</span></>}
                    </div>

                    {/* Desktop Panel Toggles */}
                    <div className="hidden md:flex items-center bg-zinc-900/80 rounded-lg p-1 border border-zinc-800/50">
                        <button
                            onClick={() => setShowLeftPanel(!showLeftPanel)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${showLeftPanel ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
                        >
                            <MessageSquare className="w-4 h-4" /> 消息 ({room?.users.length})
                        </button>
                        <div className="w-px h-4 bg-zinc-800 mx-1" />
                        <button
                            onClick={() => setShowRightPanel(!showRightPanel)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${showRightPanel ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white'}`}
                        >
                            <SearchIcon className="w-4 h-4" /> 点歌
                        </button>
                    </div>

                    <button
                        onClick={leaveRoom}
                        className="flex items-center gap-1.5 text-xs sm:text-sm text-red-400 hover:text-white px-3 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors shrink-0"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:inline">离开房间</span>
                    </button>
                </div>
            </header>

            {/* Main Content Area */}
            <div className="flex-1 flex overflow-hidden relative">

                {/* Desktop Left Panel (Users & Chat) */}
                <AnimatePresence>
                    {showLeftPanel && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 320, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            className="hidden md:flex flex-col border-r border-zinc-800/50 bg-zinc-900/30 overflow-hidden shrink-0 z-10"
                        >
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                <div>
                                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-1">在线用户 ({room?.users.length})</h3>
                                    <div className="space-y-1 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                                        {room?.users.map(u => (
                                            <div key={u.id} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-zinc-800/30">
                                                <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-300 shrink-0">
                                                    {u.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-sm truncate font-medium">{u.name}</span>
                                                {u.name === room?.hostName && <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded ml-auto shrink-0">房主</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="h-px bg-zinc-800/50 w-full" />
                                <div className="flex-1 flex flex-col pt-1">
                                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2 px-1">实时聊天</h3>
                                    <ChatBox />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Center Player Area */}
                <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-8 relative min-w-0 z-0 overflow-hidden">
                    <Player isHost={isHost} />
                </div>

                {/* Desktop Right Panel (Search & Queue) */}
                <AnimatePresence>
                    {showRightPanel && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 384, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            className="hidden md:flex flex-col border-l border-zinc-800/50 bg-zinc-900/30 overflow-hidden shrink-0 z-10"
                        >
                            <SearchPanel />
                            <QueuePanel isHost={isHost} />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Mobile Bottom Navigation Bar */}
            <div className="md:hidden shrink-0 h-14 bg-zinc-900 border-t border-zinc-800/50 flex items-center justify-around px-2 z-40 relative">
                <button
                    onClick={() => setActiveMobileTab(activeMobileTab === 'users' ? 'none' : 'users')}
                    className={`flex flex-col items-center gap-1 p-2 w-16 transition-colors ${activeMobileTab === 'users' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <Users className="w-5 h-5" />
                    <span className="text-[10px] leading-none">在线</span>
                </button>
                <button
                    onClick={() => setActiveMobileTab(activeMobileTab === 'chat' ? 'none' : 'chat')}
                    // 添加红点提示的逻辑（可选）
                    className={`flex flex-col items-center gap-1 p-2 w-16 transition-colors relative ${activeMobileTab === 'chat' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <MessageSquare className="w-5 h-5" />
                    <span className="text-[10px] leading-none">聊天</span>
                </button>
                <div className="w-px h-8 bg-zinc-800/80" />
                <button
                    onClick={() => setActiveMobileTab(activeMobileTab === 'search' ? 'none' : 'search')}
                    className={`flex flex-col items-center gap-1 p-2 w-16 transition-colors ${activeMobileTab === 'search' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <SearchIcon className="w-5 h-5" />
                    <span className="text-[10px] leading-none">点歌</span>
                </button>
                <button
                    onClick={() => setActiveMobileTab(activeMobileTab === 'queue' ? 'none' : 'queue')}
                    className={`flex flex-col items-center gap-1 p-2 w-16 transition-colors ${activeMobileTab === 'queue' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <ListMusic className="w-5 h-5" />
                    <span className="text-[10px] leading-none">队列</span>
                </button>
            </div>

            {/* Mobile Bottom Sheets / Modals */}
            <AnimatePresence>
                {activeMobileTab !== 'none' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm"
                        onClick={(e) => {
                            // 只有点击背景时才关闭
                            if (e.target === e.currentTarget) setActiveMobileTab('none');
                        }}
                    >
                        <motion.div
                            initial={{ y: "100%" }}
                            animate={{ y: 0 }}
                            exit={{ y: "100%" }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="bg-zinc-950 flex flex-col rounded-t-2xl shadow-2xl border-t border-zinc-800"
                            style={{ height: "80vh" }}
                            onClick={(e) => e.stopPropagation()} // 防止点击内容区关闭
                        >
                            <div className="flex items-center justify-between p-4 border-b border-zinc-800/50">
                                <h3 className="font-semibold">
                                    {activeMobileTab === 'users' && '在线用户'}
                                    {activeMobileTab === 'chat' && '聊天大厅'}
                                    {activeMobileTab === 'search' && '搜索歌曲'}
                                    {activeMobileTab === 'queue' && '播放队列'}
                                </h3>
                                <button
                                    onClick={() => setActiveMobileTab('none')}
                                    className="p-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-hidden flex flex-col relative w-full h-full bg-zinc-950 pb-4">
                                {activeMobileTab === 'users' && (
                                    <div className="space-y-1 overflow-y-auto p-4 flex-1">
                                        {room?.users.map(u => (
                                            <div key={u.id} className="flex items-center gap-3 p-3 rounded-xl bg-zinc-900/50 border border-zinc-800/50">
                                                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-sm font-bold text-zinc-300 shrink-0 shadow-inner">
                                                    {u.name.charAt(0).toUpperCase()}
                                                </div>
                                                <span className="text-base truncate font-medium flex-1">{u.name}</span>
                                                {u.name === room?.hostName && <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-md shrink-0 border border-emerald-500/20">房主</span>}
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {activeMobileTab === 'chat' && (
                                    <div className="flex-1 p-2 overflow-hidden flex flex-col">
                                        <ChatBox />
                                    </div>
                                )}
                                {activeMobileTab === 'search' && (
                                    <div className="flex-1 overflow-hidden flex flex-col h-full bg-zinc-950">
                                        <SearchPanel />
                                    </div>
                                )}
                                {activeMobileTab === 'queue' && (
                                    <div className="flex-1 overflow-hidden flex flex-col h-full bg-zinc-950">
                                        <QueuePanel isHost={isHost} />
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
}
