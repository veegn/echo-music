import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Users, MessageSquare, Search as SearchIcon, ListMusic, X, LogOut, WifiOff, LoaderCircle, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import ChatBox from './ChatBox';
import Player from './Player';
import MusicPanel from './MusicPanel';

export default function RoomView() {
    const { room, leaveRoom, deleteRoom, userName, connectionState, showToast } = useStore();
    const isHost = room?.hostName === userName;
    const [showRightPanel, setShowRightPanel] = useState(false);
    const [showChatPopup, setShowChatPopup] = useState(false);
    const [activeMobileTab, setActiveMobileTab] = useState<'none' | 'chat' | 'users' | 'music'>('none');

    useEffect(() => {
        let wakeLock: any = null;

        const requestWakeLock = async () => {
            try {
                if ('wakeLock' in navigator && document.visibilityState === 'visible') {
                    wakeLock = await (navigator as any).wakeLock.request('screen');
                }
            } catch (err) {
                console.warn('Wake Lock request failed:', err);
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
                wakeLock.release().catch(() => {});
            }
        };
    }, []);

    const handleDeleteRoom = async () => {
        if (!room || !isHost) return;
        if (!window.confirm(`\u786e\u8ba4\u5220\u9664\u623f\u95f4\u300a${room.name}\u300b\u5417\uff1f\u5220\u9664\u540e\u623f\u95f4\u548c\u5df2\u4fdd\u5b58\u7684 Cookie \u5c06\u4e00\u5e76\u79fb\u9664\u3002`)) return;

        try {
            await deleteRoom();
        } catch (error: any) {
            showToast(error?.message || '\u5220\u9664\u623f\u95f4\u5931\u8d25', 'error');
        }
    };

    return (
        <div className="flex flex-col h-screen bg-zinc-950 text-zinc-50 overflow-hidden font-sans relative">
            <header className="shrink-0 h-16 glass-panel z-40 px-6 flex items-center justify-between shadow-xl">
                <div className="flex items-center gap-4 min-w-0">
                    <div className="flex flex-col flex-1 min-w-0">
                        <h2 className="font-extrabold text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-400 truncate leading-tight">
                            {room?.name}
                        </h2>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
                            <span className="flex items-center gap-1.5 bg-zinc-800/40 px-2 py-0.5 rounded border border-zinc-700/30">
                                <span className="text-zinc-500">{'\u623f\u4e3b'}</span>
                                <span className="text-zinc-300 font-medium truncate max-w-[120px]">{room?.hostName}</span>
                            </span>
                            {room?.hostQQId && (
                                <span className="text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                                    QQ: {room.hostQQId}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                    <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 shadow-sm">
                        {connectionState === 'connected' && (
                            <>
                                <div className="relative flex h-2 w-2 mr-1">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                                </div>
                                <span className="text-zinc-300">{'\u5df2\u8fde\u63a5'}</span>
                            </>
                        )}
                        {connectionState === 'connecting' && (
                            <>
                                <LoaderCircle className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                                <span className="text-amber-400">{'\u91cd\u8fde\u4e2d'}</span>
                            </>
                        )}
                        {connectionState === 'disconnected' && (
                            <>
                                <WifiOff className="w-3.5 h-3.5 text-red-400" />
                                <span className="text-red-400">{'\u5df2\u65ad\u5f00'}</span>
                            </>
                        )}
                    </div>

                    <div className="hidden md:flex items-center bg-zinc-900/50 rounded-xl p-1 border border-zinc-800/50 backdrop-blur-md">
                        <button
                            onClick={() => setShowRightPanel(!showRightPanel)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${showRightPanel ? 'bg-zinc-800 text-white shadow-sm' : 'btn-ghost'}`}
                        >
                            <SearchIcon className="w-4 h-4" />
                            {'\u97f3\u4e50\u63a7\u5236\u53f0'}
                        </button>
                    </div>

                    <button
                        onClick={leaveRoom}
                        className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-red-400 hover:text-red-300 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all shrink-0"
                    >
                        <LogOut className="w-4 h-4" />
                        <span className="hidden sm:inline">{'\u79bb\u5f00\u623f\u95f4'}</span>
                    </button>
                    {isHost && (
                        <button
                            onClick={() => { void handleDeleteRoom(); }}
                            className="flex items-center gap-1.5 text-xs sm:text-sm font-medium text-red-300 hover:text-red-200 px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 transition-all shrink-0"
                        >
                            <Trash2 className="w-4 h-4" />
                            <span className="hidden sm:inline">{'\u5220\u9664\u623f\u95f4'}</span>
                        </button>
                    )}
                </div>
            </header>

            <div className="flex-1 flex overflow-hidden relative">
                <div className="hidden md:flex fixed left-6 top-24 bottom-32 w-56 flex-col items-start gap-4 z-30 pointer-events-none">
                    <div className="w-full flex items-center justify-between bg-zinc-900/40 backdrop-blur-xl border border-zinc-800/60 px-4 py-3 rounded-2xl shadow-xl shadow-black/20">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                                <Users className="w-4 h-4 text-emerald-400" />
                            </div>
                            <span className="text-sm font-bold text-zinc-200 tracking-wide">在线成员</span>
                        </div>
                        <div className="bg-zinc-800/80 px-2 py-0.5 rounded-md text-xs font-bold text-zinc-400">
                            {room?.users.length}
                        </div>
                    </div>

                    <div className="flex-1 w-full flex flex-col gap-2 overflow-y-auto custom-scrollbar pointer-events-auto pr-2 pb-10">
                        {room?.users.map((member, index) => (
                            <motion.div
                                key={member.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.05 }}
                                className="group flex items-center gap-3 w-full bg-zinc-900/40 backdrop-blur-md border border-zinc-800/40 p-2.5 rounded-xl shadow-lg hover:bg-zinc-800/80 hover:border-emerald-500/30 transition-all cursor-default"
                            >
                                <div className={`relative w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${member.name === room?.hostName ? 'bg-emerald-500/10 border border-emerald-500/40 text-emerald-400' : 'bg-gradient-to-br from-zinc-700 to-zinc-800 border border-zinc-600/50 text-zinc-200'}`}>
                                    {member.name.charAt(0).toUpperCase()}
                                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-zinc-900 rounded-full" />
                                </div>
                                <div className="flex flex-col min-w-0 flex-1">
                                    <span className="text-sm font-semibold text-zinc-200 truncate group-hover:text-emerald-400 transition-colors">
                                        {member.name}
                                    </span>
                                    <span className={`text-[10px] font-medium ${member.name === room?.hostName ? 'text-emerald-500' : 'text-zinc-500'}`}>
                                        {member.name === room?.hostName ? '房主' : '听众'}
                                    </span>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                </div>

                <div className="hidden md:flex fixed left-6 bottom-10 flex-col items-start z-40 pointer-events-none">
                    <AnimatePresence>
                        {showChatPopup && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20, transformOrigin: 'bottom left' }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                className="w-80 h-[450px] bg-zinc-900/80 backdrop-blur-2xl border border-zinc-800/60 shadow-2xl shadow-black/40 rounded-3xl mb-4 overflow-hidden pointer-events-auto flex flex-col"
                            >
                                <div className="flex items-center justify-between p-4 border-b border-zinc-800/50 bg-zinc-900/30">
                                    <div className="flex items-center gap-2">
                                        <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                                            <MessageSquare className="w-4 h-4 text-emerald-400" />
                                        </div>
                                        <span className="text-sm font-bold text-zinc-100 tracking-wide">实时聊天</span>
                                    </div>
                                    <button
                                        onClick={() => setShowChatPopup(false)}
                                        className="p-1.5 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                                    >
                                        <X className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="flex-1 overflow-hidden h-full">
                                    <ChatBox />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <button
                        onClick={() => setShowChatPopup(!showChatPopup)}
                        className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl shadow-black/30 transition-all pointer-events-auto active:scale-95 group border ${showChatPopup ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' : 'bg-zinc-900/80 backdrop-blur-xl text-zinc-300 border-zinc-800 hover:border-emerald-500/30 hover:bg-zinc-800'}`}
                    >
                        <div className={`relative flex items-center justify-center ${showChatPopup ? 'text-emerald-400' : 'text-emerald-500 group-hover:text-emerald-400'}`}>
                            {showChatPopup ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
                        </div>
                        {!showChatPopup && <span className="text-sm font-semibold tracking-wide pr-2">打开聊天</span>}
                    </button>
                </div>

                <div className="hidden md:flex fixed right-6 top-24 bottom-32 flex-col items-end z-30 pointer-events-none">
                    <AnimatePresence>
                        {showRightPanel && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95, x: 20 }}
                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.95, x: 20 }}
                                className="w-[420px] h-full bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 shadow-2xl rounded-3xl overflow-hidden pointer-events-auto flex flex-col"
                            >
                                <div className="flex-1 overflow-hidden flex flex-col relative">
                                    <MusicPanel isHost={isHost} />
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="flex-1 flex flex-col relative min-w-0 z-0 overflow-hidden">
                    <Player isHost={isHost} />
                </div>
            </div>

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
                    className={`flex flex-col items-center gap-1 p-2 w-16 transition-colors relative ${activeMobileTab === 'chat' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <MessageSquare className="w-5 h-5" />
                    <span className="text-[10px] leading-none">聊天</span>
                </button>
                <div className="w-px h-8 bg-zinc-800/80" />
                <button
                    onClick={() => setActiveMobileTab(activeMobileTab === 'music' ? 'none' : 'music')}
                    className={`flex flex-col items-center gap-1 p-2 w-16 transition-colors ${activeMobileTab === 'music' ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                    <ListMusic className="w-5 h-5" />
                    <span className="text-[10px] leading-none">音乐</span>
                </button>
            </div>

            <AnimatePresence>
                {activeMobileTab !== 'none' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) setActiveMobileTab('none');
                        }}
                    >
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            className="bg-zinc-950/95 backdrop-blur-2xl flex flex-col rounded-t-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] border-t border-zinc-800/60"
                            style={{ height: '80vh' }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between p-4 border-b border-zinc-800/50">
                                <h3 className="font-semibold">
                                    {activeMobileTab === 'users' && '在线用户'}
                                    {activeMobileTab === 'chat' && '聊天大厅'}
                                    {activeMobileTab === 'music' && '音乐控制'}
                                </h3>
                                <button
                                    onClick={() => setActiveMobileTab('none')}
                                    className="p-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-hidden flex flex-col relative w-full h-full pb-4">
                                {activeMobileTab === 'users' && (
                                    <div className="space-y-2 overflow-y-auto p-4 flex-1 custom-scrollbar">
                                        {room?.users.map((member, index) => (
                                            <motion.div
                                                key={member.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: index * 0.05 }}
                                                className="flex items-center gap-4 p-3.5 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 shadow-sm"
                                            >
                                                <div className={`relative w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${member.name === room?.hostName ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-gradient-to-br from-zinc-800 to-zinc-900 border border-zinc-700/50 text-zinc-300'}`}>
                                                    {member.name.charAt(0).toUpperCase()}
                                                    <div className="absolute w-3.5 h-3.5 bg-emerald-500 border-2 border-zinc-950 rounded-full bottom-0 right-0" />
                                                </div>
                                                <div className="flex flex-col flex-1 min-w-0">
                                                    <span className="text-base font-semibold text-zinc-100 truncate">{member.name}</span>
                                                    <span className="text-xs text-zinc-500">
                                                        {member.name === room?.hostName ? '房主' : '听众'}
                                                    </span>
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                )}
                                {activeMobileTab === 'chat' && (
                                    <div className="flex-1 p-2 overflow-hidden flex flex-col">
                                        <ChatBox />
                                    </div>
                                )}
                                {activeMobileTab === 'music' && (
                                    <div className="flex-1 overflow-hidden flex flex-col h-full bg-zinc-950">
                                        <MusicPanel isHost={isHost} />
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
