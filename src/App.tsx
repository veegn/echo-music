import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Music, Lock, Users, Plus, UserCircle, Edit2, PlayCircle, Loader2 } from 'lucide-react';
import { useStore } from './store';
import RoomView from './components/RoomView';

// --- 全局 Toast 组件 ---
function GlobalToast() {
  const { toast } = useStore();
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-none"
        >
          <div className="bg-zinc-800/90 backdrop-blur-md border border-zinc-700 shadow-2xl rounded-full px-6 py-3 flex items-center gap-3">
            {toast.type === 'success' && <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />}
            {toast.type === 'error' && <div className="w-2 h-2 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)]" />}
            {toast.type === 'info' && <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.8)]" />}
            <span className="text-sm font-medium text-white tracking-wide">{toast.message}</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function App() {
  const { userName, setUserName, room, joinRoom, showToast } = useStore();
  const [rooms, setRooms] = useState<any[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(new URLSearchParams(window.location.search).get('room'));

  // 欢迎/修改昵称弹窗状态
  const [showWelcome, setShowWelcome] = useState(!userName);
  const [welcomeInput, setWelcomeInput] = useState(userName || '');

  // 密码输入框状态 (代替原生 prompt)
  const [joinRoomTarget, setJoinRoomTarget] = useState<any>(null);
  const [joinPassword, setJoinPassword] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    fetchRooms();
    const interval = setInterval(fetchRooms, 5000);
    return () => clearInterval(interval);
  }, []);

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
    if (userName && pendingRoomId && rooms.length > 0) {
      const r = rooms.find(r => r.id === pendingRoomId);
      if (r) {
        handleJoinRoom(r);
      } else {
        showToast('该房间不存在或已解散', 'error');
        window.history.replaceState({}, '', '/');
      }
      setPendingRoomId(null);
    }
  }, [userName, pendingRoomId, rooms]);

  /** 欢迎/修改弹窗确认 */
  const handleWelcomeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!welcomeInput.trim()) return;
    setUserName(welcomeInput.trim());
    setShowWelcome(false);
  };

  const handleCreateRoom = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const roomName = formData.get('roomName') as string;
    const password = formData.get('password') as string;

    if (!userName) {
      setShowWelcome(true);
      return;
    }

    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: roomName, password, hostName: userName }),
      });
      const data = await res.json();
      await joinRoom(data.id, password);
      showToast('房间创建成功', 'success');
      setShowCreate(false);
    } catch (e) {
      console.error('[App] 创建房间失败:', e);
      showToast('创建房间失败，请重试', 'error');
    }
  };

  const handleJoinRoom = async (r: any) => {
    if (!userName) {
      setShowWelcome(true);
      return;
    }

    if (r.hasPassword) {
      // 弹出自定义密码输入框
      setJoinRoomTarget(r);
      setJoinPassword('');
      return;
    }

    executeJoin(r.id);
  };

  const executeJoin = async (id: string, password?: string) => {
    setIsJoining(true);
    try {
      await joinRoom(id, password);
      showToast('成功加入房间', 'success');
      setJoinRoomTarget(null);
    } catch (e: any) {
      console.error('[App] 加入房间失败:', e.message);
      showToast(e.message === 'Incorrect password' ? '密码不正确' : '加入房间失败', 'error');
      if (e.message !== 'Incorrect password') {
        setJoinRoomTarget(null);
      }
    } finally {
      setIsJoining(false);
    }
  };

  const formatSinger = (singer: unknown): string => {
    if (Array.isArray(singer)) {
      return singer.map((s: any) => s.name || s).join(', ');
    }
    if (typeof singer === 'string') return singer;
    return '未知歌手';
  };

  if (room) {
    return (
      <>
        <GlobalToast />
        <RoomView />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-emerald-500/30">
      <GlobalToast />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-10 sm:mb-16">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Music className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">IYC音乐</h1>
          </div>

          <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto justify-between sm:justify-end">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 rounded-lg border border-zinc-800">
              <UserCircle className="w-4 h-4 text-zinc-400" />
              <span className="text-sm text-zinc-300 max-w-[100px] sm:max-w-none truncate">{userName || '未登录'}</span>
              <button
                onClick={() => {
                  setWelcomeInput(userName);
                  setShowWelcome(true);
                }}
                className="text-emerald-400 hover:text-emerald-300 ml-1 p-1"
                title="修改昵称"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              onClick={() => setShowCreate(true)}
              className="bg-zinc-100 text-zinc-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-white transition-colors flex items-center gap-2 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              创建房间
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <AnimatePresence>
            {rooms.map((r: any) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={() => handleJoinRoom(r)}
                className="group relative bg-zinc-900/50 border border-zinc-800/50 rounded-2xl p-5 sm:p-6 cursor-pointer hover:bg-zinc-900 hover:border-zinc-700 transition-all overflow-hidden flex flex-col"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative z-10 flex-1">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-semibold truncate pr-4">{r.name}</h3>
                    {r.hasPassword && <Lock className="w-4 h-4 text-zinc-500 shrink-0" />}
                  </div>

                  {/* 当前播放音乐信息 */}
                  {r.currentSong ? (
                    <div className="mb-4 flex items-center gap-3 bg-zinc-950/50 p-2 rounded-lg border border-zinc-800/50">
                      <img
                        src={`https://y.qq.com/music/photo_new/T002R300x300M000${r.currentSong.albummid}.jpg`}
                        className="w-10 h-10 rounded object-cover"
                        onError={(e) => { (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/music/300/300?blur=4'; }}
                      />
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-medium text-emerald-400 truncate flex items-center gap-1.5">
                          <PlayCircle className="w-3 h-3" />
                          {r.currentSong.songname}
                        </span>
                        <span className="text-[10px] text-zinc-500 truncate">{formatSinger(r.currentSong.singer)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4 flex items-center justify-center p-3 rounded-lg border border-dashed border-zinc-800/50 text-xs text-zinc-600">
                      暂无播放
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm text-zinc-400 mt-auto">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-xs text-zinc-300">
                        {r.hostName.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate max-w-[100px]">{r.hostName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 bg-zinc-800/50 px-2 py-0.5 rounded-full">
                      <Users className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">{r.usersCount}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {rooms.length === 0 && (
            <div className="col-span-full py-16 sm:py-20 text-center text-zinc-500">
              当前没有活跃的房间，来创建第一个吧！
            </div>
          )}
        </div>
      </div>

      {showCreate && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-md shadow-2xl"
          >
            <h2 className="text-xl font-semibold mb-6">创建房间</h2>
            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">房间名称</label>
                <input
                  name="roomName"
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  placeholder="例如：一起听歌"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1.5">密码 (可选)</label>
                <input
                  name="password"
                  type="password"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
                  placeholder="留空则为公开房间"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-emerald-500 text-zinc-950 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
                >
                  创建
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {showWelcome && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[60] p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 sm:p-8 w-full max-w-sm shadow-2xl text-center"
          >
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
              <UserCircle className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold mb-2">
              {userName ? '修改昵称 ✏️' : '欢迎来到 IYC音乐 🎵'}
            </h2>
            <p className="text-sm text-zinc-400 mb-6">请输入您的昵称，开始一起听歌吧！</p>
            <form onSubmit={handleWelcomeSubmit}>
              <input
                value={welcomeInput}
                onChange={e => setWelcomeInput(e.target.value)}
                placeholder="输入您的昵称..."
                autoFocus
                required
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-center text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all mb-4"
              />
              <div className="flex gap-3">
                {userName && (
                  <button
                    type="button"
                    onClick={() => setShowWelcome(false)}
                    className="flex-1 px-4 py-3 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                  >
                    取消
                  </button>
                )}
                <button
                  type="submit"
                  className="flex-1 bg-emerald-500 text-zinc-950 px-4 py-3 rounded-lg text-sm font-semibold hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20"
                >
                  确定
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* 密码输入 Modal */}
      {joinRoomTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">私密房间</h2>
                <p className="text-xs text-zinc-400 truncate max-w-[200px]">{joinRoomTarget.name}</p>
              </div>
            </div>

            <form onSubmit={(e) => { e.preventDefault(); executeJoin(joinRoomTarget.id, joinPassword); }} className="space-y-4">
              <div>
                <input
                  type="password"
                  value={joinPassword}
                  onChange={e => setJoinPassword(e.target.value)}
                  required
                  autoFocus
                  placeholder="请输入房间密码"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all text-center tracking-widest"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setJoinRoomTarget(null)}
                  disabled={isJoining}
                  className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isJoining}
                  className="flex-1 bg-emerald-500 text-zinc-950 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/20 flex items-center justify-center"
                >
                  {isJoining ? <Loader2 className="w-4 h-4 animate-spin" /> : '进入房间'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
