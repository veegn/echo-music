import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Lock, Users, Plus, Edit2, Library } from 'lucide-react';
import { useStore } from './store';
import OfflineLibrary from './components/OfflineLibrary';
import RoomView from './components/RoomView';
import {
  WelcomeDialog,
  CreateRoomDialog,
  JoinRoomDialog,
  GlobalToast,
  SystemNotificationBubbles,
} from './components/Dialogs';

const LobbyHeader: React.FC<{
  userName: string;
  onEditName: () => void;
  onCreateRoom: () => void;
  onOpenOfflineLibrary: () => void;
}> = ({ userName, onEditName, onCreateRoom, onOpenOfflineLibrary }) => (
  <header className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-12 sm:mb-20 glass-panel px-6 py-4 sm:px-8 sm:py-5 rounded-[32px] shadow-2xl shadow-black/40">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/30 border border-emerald-400/20">
        <Music className="w-6 h-6 text-white" />
      </div>
      <div className="flex flex-col">
        <h1 className="text-2xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-400 leading-tight">
          Echo Music
        </h1>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            大厅
          </span>
          <span className="text-xs font-medium text-zinc-500">一起听歌，实时同频</span>
        </div>
      </div>
    </div>
    <div className="flex items-center gap-3 sm:gap-5 w-full sm:w-auto justify-between sm:justify-end">
      <button
        onClick={onOpenOfflineLibrary}
        className="flex items-center gap-2 px-4 h-12 rounded-2xl bg-zinc-900/55 border border-zinc-800/80 text-zinc-200 hover:text-emerald-400 hover:border-emerald-500/30 transition-colors"
      >
        <Library className="w-4 h-4" />
        <span className="text-sm font-semibold">本地音乐库</span>
      </button>
      <div className="flex items-center gap-3 pl-4 pr-1.5 py-1.5 bg-zinc-900/50 rounded-2xl border border-zinc-800/80 shadow-inner backdrop-blur-md">
        <div className="flex flex-col items-end">
          <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">当前用户</span>
          <span className="text-sm font-bold text-zinc-200 max-w-[100px] sm:max-w-none truncate leading-none">
            {userName || '未设置昵称'}
          </span>
        </div>
        <button
          onClick={onEditName}
          className="w-10 h-10 flex items-center justify-center btn-ghost border border-zinc-700/30"
          title="修改昵称"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      </div>
      <button
        onClick={onCreateRoom}
        className="group relative btn-primary h-12 px-6 overflow-hidden flex items-center gap-2"
      >
        <Plus className="w-4 h-4 relative z-10" />
        <span className="relative z-10">创建房间</span>
        <div className="absolute inset-0 bg-white/20 translate-y-12 group-hover:translate-y-0 transition-transform duration-300" />
      </button>
    </div>
  </header>
);

const RoomCard: React.FC<{ room: any; onClick: () => void }> = ({ room, onClick }) => {
  const coverUrl = room.currentSong?.albummid
    ? `https://y.qq.com/music/photo_new/T002R300x300M000${room.currentSong.albummid}.jpg`
    : 'https://picsum.photos/seed/music/300/300?blur=10';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={onClick}
      className="group relative h-[280px] glass-card rounded-[32px] hover:border-emerald-500/40 transition-all duration-500 flex flex-col p-1 active:scale-[0.98]"
    >
      <div className="absolute -top-10 -right-10 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/30 group-hover:scale-150 transition-all duration-700" />
      <div className="relative z-10 h-full flex flex-col p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-black tracking-tight text-white group-hover:text-emerald-400 transition-colors truncate">
              {room.name}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] font-bold uppercase tracking-tighter text-zinc-500 bg-zinc-800/50 px-2 py-0.5 rounded-full border border-zinc-700/30">
                {room.hasPassword ? '私密' : '公开'}
              </span>
              {room.hasPassword && <Lock className="w-3 h-3 text-amber-500" />}
            </div>
          </div>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
        </div>

        <div className="flex-1 flex items-center gap-4 py-4 px-3 bg-white/5 rounded-2xl shadow-inner">
          <div className="relative group/album w-20 h-20 rounded-2xl overflow-hidden shadow-2xl">
            <img
              src={coverUrl}
              className="w-full h-full object-cover transition-transform duration-500 group-hover/album:scale-110"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/music/300/300?blur=4';
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            {room.currentSong ? (
              <>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                  </span>
                  <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">正在播放</span>
                </div>
                <h4 className="text-base font-bold text-zinc-100 truncate mb-0.5">{room.currentSong.songname}</h4>
                <p className="text-xs font-semibold text-zinc-500 truncate">
                  {typeof room.currentSong.singer === 'string' ? room.currentSong.singer : '未知歌手'}
                </p>
              </>
            ) : (
              <div className="flex flex-col opacity-40">
                <Music className="w-5 h-5 mb-1 text-zinc-400" />
                <span className="text-xs font-bold text-zinc-400 tracking-tight">暂无播放内容</span>
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-8 h-8 rounded-xl bg-gradient-to-br from-zinc-700 to-zinc-900 flex items-center justify-center text-[10px] font-black text-zinc-300 border border-white/5">
              {room.hostName.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-tighter">房主</span>
              <span className="text-xs font-bold text-zinc-300">{room.hostName}</span>
            </div>
          </div>
          <div className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2">
            <Users className="w-3 h-3 text-emerald-400" />
            <span className="text-xs font-black text-emerald-400">{room.usersCount}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default function App() {
  const { userName, room, joinRoom, showToast } = useStore();
  const [pathname, setPathname] = useState(window.location.pathname);
  const [rooms, setRooms] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(
    new URLSearchParams(window.location.search).get('room')
  );
  const [showWelcome, setShowWelcome] = useState(!userName);
  const [welcomeForceInitial, setWelcomeForceInitial] = useState('');
  const [joinRoomTarget, setJoinRoomTarget] = useState<any>(null);

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const isLobbyPage = pathname === '/';

  useEffect(() => {
    if (room || !isLobbyPage) return;
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, [room, isLobbyPage]);

  const fetchRooms = async () => {
    try {
      const res = await fetch('/api/rooms');
      const data = await res.json();
      setRooms(data);
    } catch (e) {
      console.error('[App] 获取房间列表失败:', e);
    }
  };

  useEffect(() => {
    if (!isLobbyPage) return;
    if (userName && pendingRoomId && rooms.length > 0) {
      const targetRoom = rooms.find((item) => item.id === pendingRoomId);
      if (targetRoom) {
        handleJoinRoom(targetRoom);
      } else {
        showToast('该房间不存在或已解散', 'error');
        window.history.replaceState({}, '', '/');
      }
      setPendingRoomId(null);
    }
  }, [userName, pendingRoomId, rooms, isLobbyPage]);

  const handleJoinRoom = async (targetRoom: any) => {
    if (!userName) {
      setShowWelcome(true);
      return;
    }

    if (targetRoom.hasPassword) {
      setJoinRoomTarget(targetRoom);
      return;
    }

    await executeJoin(targetRoom.id);
  };

  const executeJoin = async (id: string) => {
    try {
      await joinRoom(id);
      showToast('成功加入房间', 'success');
      setJoinRoomTarget(null);
    } catch (e: any) {
      console.error('[App] 加入房间失败:', e.message);
      showToast('加入房间失败', 'error');
    }
  };

  useEffect(() => {
    if (room?.currentSong) {
      const singer = typeof room.currentSong.singer === 'string' ? room.currentSong.singer : '未知歌手';
      document.title = `正在播放：${room.currentSong.songname} - ${singer}`;
    } else if (room) {
      document.title = `${room.name} - Echo Music`;
    } else {
      document.title = 'Echo Music - 一起听歌';
    }
  }, [room?.currentSong, room?.name]);

  if (room) {
    return (
      <>
        <GlobalToast />
        <SystemNotificationBubbles />
        <RoomView />
      </>
    );
  }

  if (pathname === '/offline-library') {
    return <OfflineLibrary onBack={() => {
      window.history.pushState({}, '', '/');
      setPathname('/');
    }} />;
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-emerald-500/30 relative overflow-hidden">
      <div className="absolute top-0 inset-x-0 h-96 bg-gradient-to-b from-emerald-500/5 to-transparent pointer-events-none" />
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute top-60 -left-20 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

      <GlobalToast />

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 relative z-10">
        <LobbyHeader
          userName={userName}
          onEditName={() => {
            setWelcomeForceInitial(userName);
            setShowWelcome(true);
          }}
          onCreateRoom={() => setShowCreate(true)}
          onOpenOfflineLibrary={() => {
            window.history.pushState({}, '', '/offline-library');
            setPathname('/offline-library');
          }}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-8">
          <AnimatePresence>
            {rooms.map((targetRoom: any) => (
              <RoomCard key={targetRoom.id} room={targetRoom} onClick={() => handleJoinRoom(targetRoom)} />
            ))}
          </AnimatePresence>
          {rooms.length === 0 && (
            <div className="col-span-full py-16 sm:py-20 text-center text-zinc-500">
              当前还没有活跃房间，来创建第一个吧。
            </div>
          )}
        </div>
      </div>

      <CreateRoomDialog isOpen={showCreate} onClose={() => setShowCreate(false)} />
      <WelcomeDialog
        isOpen={showWelcome}
        onClose={() => setShowWelcome(false)}
        initialName={welcomeForceInitial}
      />
      <JoinRoomDialog
        targetRoom={joinRoomTarget}
        onClose={() => setJoinRoomTarget(null)}
        onJoinSuccess={() => setJoinRoomTarget(null)}
      />
    </div>
  );
}
