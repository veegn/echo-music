import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Lock, Users, Plus, Edit2, Library } from 'lucide-react';
import { useStore } from './store';
import OfflineLibrary from './components/OfflineLibrary';
import RoomView from './components/RoomView';
import WelcomeDialog from './components/dialogs/WelcomeDialog';
import CreateRoomDialog from './components/dialogs/CreateRoomDialog';
import JoinRoomDialog from './components/dialogs/JoinRoomDialog';
import GlobalToast from './components/notifications/GlobalToast';
import SystemNotificationBubbles from './components/notifications/SystemNotificationBubbles';

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
          className="w-8 h-8 rounded-xl bg-zinc-800 hover:bg-zinc-700 flex items-center justify-center text-zinc-400 hover:text-white transition-all shadow-lg"
        >
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <button
        onClick={onCreateRoom}
        className="flex items-center gap-2 px-6 h-12 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-white shadow-xl shadow-emerald-500/20 transition-all active:scale-95 group"
      >
        <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
        <span className="text-sm font-bold">创建房间</span>
      </button>
    </div>
  </header>
);

const RoomCard: React.FC<{
  room: any;
  onJoin: (room: any) => void;
}> = ({ room, onJoin }) => (
  <motion.div
    layout
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    whileHover={{ y: -5, scale: 1.02 }}
    className="group relative bg-zinc-900/40 backdrop-blur-md border border-zinc-800/80 rounded-[32px] overflow-hidden hover:border-emerald-500/40 hover:bg-zinc-900/60 transition-all duration-300 shadow-xl hover:shadow-emerald-500/10"
  >
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="w-12 h-12 rounded-2xl bg-zinc-950 flex items-center justify-center border border-zinc-800 group-hover:border-emerald-500/30 transition-colors">
          {room.hasPassword ? (
            <Lock className="w-5 h-5 text-amber-500/80" />
          ) : (
            <Music className="w-5 h-5 text-emerald-500/80" />
          )}
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-950/50 border border-zinc-800/50">
          <Users className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-xs font-bold text-zinc-300">{room.members?.length ?? room.usersCount ?? room.users?.length ?? 0}</span>
        </div>
      </div>

      <h3 className="text-xl font-bold text-zinc-100 mb-2 truncate group-hover:text-emerald-400 transition-colors">
        {room.name}
      </h3>
      <div className="flex items-center gap-2 mb-8">
        <div className="w-5 h-5 rounded-lg bg-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-500">
          {room.hostName.charAt(0).toUpperCase()}
        </div>
        <span className="text-xs font-medium text-zinc-500">房主：{room.hostName}</span>
      </div>

      <button
        onClick={() => onJoin(room)}
        className="w-full py-4 rounded-2xl bg-zinc-950 hover:bg-emerald-500 text-zinc-300 hover:text-white font-bold text-sm border border-zinc-800 hover:border-emerald-500 transition-all shadow-lg active:scale-[0.98]"
      >
        立即加入
      </button>
    </div>
  </motion.div>
);

export default function App() {
  const { room, userName, joinRoom, fetchRooms, showToast } = useStore();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [targetJoinRoom, setTargetJoinRoom] = useState<any>(null);
  const [showOfflineLibrary, setShowOfflineLibrary] = useState(false);

  useEffect(() => {
    if (!userName) {
      setShowWelcome(true);
    }
  }, [userName]);

  useEffect(() => {
    const loadRooms = async () => {
      try {
        const data = await fetchRooms();
        setRooms(data);
      } catch {
        showToast('获取房间列表失败', 'error');
      } finally {
        setLoading(false);
      }
    };

    loadRooms();
    const timer = setInterval(loadRooms, 5000);
    return () => clearInterval(timer);
  }, [fetchRooms, showToast]);

  const handleJoinRoom = async (roomToJoin: any) => {
    if (!userName) {
      setShowWelcome(true);
      return;
    }

    if (roomToJoin.hasPassword) {
      setTargetJoinRoom(roomToJoin);
      return;
    }

    try {
      await joinRoom(roomToJoin.id);
      showToast('成功加入房间', 'success');
    } catch (error: any) {
      showToast(error.message || '加入房间失败', 'error');
    }
  };

  if (room) {
    return (
      <>
        <RoomView />
        <GlobalToast />
        <SystemNotificationBubbles />
      </>
    );
  }

  return (
    <div className="min-h-dvh bg-zinc-950 text-zinc-50 px-4 pb-4 pt-[calc(1rem_+_env(safe-area-inset-top))] sm:px-8 sm:pb-8 sm:pt-[calc(2rem_+_env(safe-area-inset-top))] md:px-12 md:pb-12 md:pt-[calc(3rem_+_env(safe-area-inset-top))] font-sans selection:bg-emerald-500/30 selection:text-emerald-200">
      <div className="max-w-7xl mx-auto">
        <LobbyHeader
          userName={userName}
          onEditName={() => setShowWelcome(true)}
          onCreateRoom={() => (userName ? setShowCreateRoom(true) : setShowWelcome(true))}
          onOpenOfflineLibrary={() => setShowOfflineLibrary(true)}
        />

        <main>
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-2 h-8 bg-emerald-500 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
              <h2 className="text-2xl font-bold tracking-tight">活跃房间</h2>
              <span className="text-xs font-bold text-zinc-500 ml-2 bg-zinc-900 px-2 py-1 rounded-lg border border-zinc-800">
                {rooms.length} 个正在运行
              </span>
            </div>
            <button
              onClick={() => {
                setLoading(true);
                fetchRooms().then(setRooms).finally(() => setLoading(false));
              }}
              className="p-2 hover:bg-zinc-900 rounded-xl text-zinc-500 hover:text-emerald-400 transition-all border border-transparent hover:border-zinc-800"
            >
              <motion.div whileTap={{ rotate: 180 }} transition={{ duration: 0.3 }}>
                <Plus className="w-5 h-5 rotate-45" />
              </motion.div>
            </button>
          </div>

          {loading && rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 bg-zinc-900/20 rounded-[40px] border border-dashed border-zinc-800">
              <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-4" />
              <p className="text-zinc-500 font-medium">正在寻找音乐房间...</p>
            </div>
          ) : rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32 bg-zinc-900/20 rounded-[40px] border border-dashed border-zinc-800 text-center px-6">
              <div className="w-20 h-20 bg-zinc-900 rounded-3xl flex items-center justify-center mb-6 border border-zinc-800 shadow-inner">
                <Music className="w-10 h-10 text-zinc-700" />
              </div>
              <h3 className="text-xl font-bold mb-2 text-zinc-300">暂无活跃房间</h3>
              <p className="text-zinc-500 max-w-xs mb-8">目前还没有正在播放的房间，快来创建一个属于你的音乐派对吧！</p>
              <button
                onClick={() => (userName ? setShowCreateRoom(true) : setShowWelcome(true))}
                className="px-8 py-3.5 bg-zinc-100 hover:bg-white text-zinc-950 font-bold rounded-2xl shadow-xl transition-all active:scale-95"
              >
                立即创建首个房间
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
              <AnimatePresence mode="popLayout">
                {rooms.map((roomItem) => (
                  <RoomCard key={roomItem.id} room={roomItem} onJoin={handleJoinRoom} />
                ))}
              </AnimatePresence>
            </div>
          )}
        </main>
      </div>

      <WelcomeDialog
        isOpen={showWelcome}
        onClose={() => setShowWelcome(false)}
        initialName={userName}
      />
      <CreateRoomDialog isOpen={showCreateRoom} onClose={() => setShowCreateRoom(false)} />
      <JoinRoomDialog
        targetRoom={targetJoinRoom}
        onClose={() => setTargetJoinRoom(null)}
        onJoinSuccess={() => setTargetJoinRoom(null)}
      />
      {showOfflineLibrary && (
        <OfflineLibrary isOpen={showOfflineLibrary} onClose={() => setShowOfflineLibrary(false)} />
      )}
      <GlobalToast />
      <SystemNotificationBubbles />
    </div>
  );
}
