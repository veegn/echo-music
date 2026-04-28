import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Users, MessageSquare, Search as SearchIcon, X } from 'lucide-react';
import { useStore } from '../store';
import ChatBox from './ChatBox';
import Player from './Player';
import MusicPanel from './MusicPanel';
import RoomHeader from './RoomHeader';
import MobileNav from './MobileNav';

export default function RoomView() {
    const { room, leaveRoom, deleteRoom, userName, connectionState, showToast } = useStore();
    const isHost = room?.hostName === userName;
    const [showRightPanel, setShowRightPanel] = useState(false);
    const [activeMobileTab, setActiveMobileTab] = useState<'none' | 'chat' | 'users' | 'music'>('none');

    useEffect(() => {
        let wakeLock: any = null;

        const requestWakeLock = async () => {
            try {
                if (room?.isPlaying && 'wakeLock' in navigator && document.visibilityState === 'visible') {
                    wakeLock = await (navigator as any).wakeLock.request('screen');
                }
            } catch (err) {
                console.warn('Wake Lock request failed:', err);
            }
        };

        const releaseWakeLock = () => {
            if (wakeLock !== null) {
                wakeLock.release().catch(() => {});
                wakeLock = null;
            }
        };

        if (room?.isPlaying) {
            requestWakeLock();
        } else {
            releaseWakeLock();
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                if (room?.isPlaying) requestWakeLock();
                const { socket } = useStore.getState();
                if (socket && socket.disconnected) {
                    socket.connect();
                }
            } else {
                releaseWakeLock();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            releaseWakeLock();
        };
    }, [room?.isPlaying]);

    const handleDeleteRoom = async () => {
        if (!room || !isHost) return;
        if (!window.confirm(`确认删除房间《${room.name}》吗？删除后房间和已保存的 Cookie 将一并移除。`)) return;

        try {
            await deleteRoom();
        } catch (error: any) {
            showToast(error?.message || '删除房间失败', 'error');
        }
    };

    return (
        <div className="flex h-dvh flex-col bg-zinc-950 text-zinc-50 overflow-hidden font-sans relative">
            <RoomHeader 
                room={room} 
                connectionState={connectionState} 
                isHost={isHost} 
                onLeave={leaveRoom} 
                onDelete={handleDeleteRoom} 
            />

            <main className="flex-1 flex min-h-0 relative">
                {/* Left Content: Player (Always visible) */}
                <div className={`flex-1 flex flex-col min-h-0 transition-all duration-500 ease-in-out relative ${showRightPanel ? 'mr-0' : ''}`}>
                    <Player isHost={isHost} />
                </div>

                {/* Desktop Right Sidebar (Collapsible) */}
                <div 
                  className={`hidden lg:flex flex-col border-l border-zinc-800 transition-all duration-300 ease-in-out bg-zinc-950/50 backdrop-blur-md overflow-hidden ${showRightPanel ? 'w-80 opacity-100' : 'w-0 opacity-0 pointer-events-none'}`}
                >
                    <div className="flex-1 flex flex-col min-h-0">
                        <div className="shrink-0 p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
                            <div className="flex items-center gap-2 font-bold text-sm text-zinc-300">
                                <MessageSquare className="w-4 h-4 text-emerald-400" />
                                聊天 & 听众
                            </div>
                            <button onClick={() => setShowRightPanel(false)} className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-zinc-300 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <ChatBox />
                        </div>
                    </div>
                </div>

                {/* Right Panel Toggle (Desktop) */}
                {!showRightPanel && (
                    <button
                        onClick={() => setShowRightPanel(true)}
                        className="hidden lg:flex absolute right-6 top-6 z-30 p-3 rounded-2xl bg-zinc-900/80 hover:bg-emerald-500/20 text-zinc-400 hover:text-emerald-400 border border-zinc-800 hover:border-emerald-500/30 transition-all shadow-2xl backdrop-blur-xl group"
                        title="打开侧边栏"
                    >
                        <MessageSquare className="w-5 h-5 group-hover:scale-110 transition-transform" />
                    </button>
                )}

                {/* Desktop Left Music Library (Fixed on Desktop) */}
                <div className="hidden lg:flex flex-col w-80 xl:w-96 border-l border-zinc-800 bg-zinc-950/30">
                    <div className="shrink-0 p-4 border-b border-zinc-800 flex items-center gap-2 bg-zinc-900/30">
                        <SearchIcon className="w-4 h-4 text-zinc-500" />
                        <span className="text-sm font-bold text-zinc-400 uppercase tracking-widest">曲库 & 搜索</span>
                    </div>
                    <div className="flex-1 min-h-0">
                        <MusicPanel isHost={isHost} />
                    </div>
                </div>

                {/* Mobile Overlays */}
                <AnimatePresence>
                    {activeMobileTab !== 'none' && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setActiveMobileTab('none')}
                            className="lg:hidden absolute inset-0 z-[45] bg-black/60 backdrop-blur-sm"
                        />
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {activeMobileTab === 'music' && (
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="lg:hidden absolute inset-x-0 bottom-0 top-14 z-[50] flex flex-col bg-zinc-950 rounded-t-[32px] overflow-hidden shadow-[0_-20px_50px_rgba(0,0,0,0.5)] border-t border-zinc-800"
                        >
                            <div className="shrink-0 h-1.5 w-12 bg-zinc-800 rounded-full mx-auto my-3" />
                            <div className="flex-1 overflow-hidden">
                                <MusicPanel isHost={isHost} />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {activeMobileTab === 'chat' && (
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="lg:hidden absolute inset-0 z-[50] flex flex-col bg-zinc-950"
                        >
                            <div className="shrink-0 h-14 flex items-center justify-between px-4 border-b border-zinc-800 bg-zinc-900/50">
                                <span className="font-bold">实时聊天</span>
                                <button onClick={() => setActiveMobileTab('none')} className="p-2"><X className="w-6 h-6" /></button>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <ChatBox />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                  {activeMobileTab === 'users' && (
                    <motion.div
                      initial={{ y: '100%' }}
                      animate={{ y: 0 }}
                      exit={{ y: '100%' }}
                      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                      className="lg:hidden absolute inset-x-0 bottom-0 top-1/4 z-[50] flex flex-col bg-zinc-950 rounded-t-[32px] overflow-hidden shadow-[0_-20px_50px_rgba(0,0,0,0.5)] border-t border-zinc-800"
                    >
                      <div className="shrink-0 h-1.5 w-12 bg-zinc-800 rounded-full mx-auto my-3" />
                      <div className="flex-1 overflow-y-auto p-6">
                        <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                          <Users className="w-6 h-6 text-emerald-400" />
                          当前在线听众
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                          {room?.users.map((member) => (
                            <div key={member.id} className="flex items-center gap-3 p-3 bg-zinc-900/50 rounded-2xl border border-zinc-800/50">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center text-emerald-400 font-bold border border-emerald-500/20">
                                {member.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-semibold truncate">{member.name}</span>
                                {member.name === room.hostName && <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider">Host</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
            </main>

            <MobileNav 
                activeTab={activeMobileTab} 
                onTabChange={setActiveMobileTab} 
                unreadCount={0} 
                memberCount={room?.users.length || 0} 
            />
        </div>
    );
}
