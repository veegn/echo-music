import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, Loader2, UserCircle, RefreshCw } from 'lucide-react';
import { useStore } from '../store';

const COOKIE_STORAGE_KEY = 'casebuy_music_vip_cookie';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    width?: string;
    zIndex?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, children, width = "max-w-md", zIndex = "z-50" }) => {
    if (!isOpen) return null;
    return (
        <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center ${zIndex} p-4`}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full ${width} shadow-2xl relative`}
            >
                {children}
            </motion.div>
        </div>
    );
};

// ================= Create Room =================
export const CreateRoomDialog: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { userName, joinRoom, showToast } = useStore();
    const handleCreateRoom = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const name = formData.get('roomName') as string;
        const password = formData.get('password') as string;
        try {
            const res = await fetch('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password, hostName: userName }),
            });
            const data = await res.json();
            await joinRoom(data.id, password);
            showToast('房间创建成功', 'success');
            onClose();
        } catch (e) {
            showToast('创建房间失败', 'error');
        }
    };
    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <h2 className="text-xl font-semibold mb-6">创建房间</h2>
            <form onSubmit={handleCreateRoom} className="space-y-4">
                <input name="roomName" required placeholder="房间名称" className="input-dark w-full" />
                <input name="password" type="password" placeholder="密码 (可选)" className="input-dark w-full" />
                <div className="flex gap-3 pt-4">
                    <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white">取消</button>
                    <button type="submit" className="flex-1 btn-primary px-4 py-2.5 rounded-lg">创建</button>
                </div>
            </form>
        </Modal>
    );
};

// ================= Welcome / Nickname =================
export const WelcomeDialog: React.FC<{ isOpen: boolean; onClose: () => void; initialName?: string }> = ({ isOpen, onClose, initialName }) => {
    const { userName, setUserName } = useStore();
    const [name, setName] = useState(initialName || userName || '');
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;
        setUserName(name.trim());
        onClose();
    };
    return (
        <Modal isOpen={isOpen} onClose={onClose} zIndex="z-[60]" width="max-w-sm">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/30">
                <UserCircle className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-center">{userName ? '修改昵称 ✏️' : '欢迎来到 Echo Music 🎵'}</h2>
            <form onSubmit={handleSubmit} className="text-center">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="输入您的昵称..." autoFocus required className="input-dark w-full text-center mb-4" />
                <div className="flex gap-3">
                    {userName && <button type="button" onClick={onClose} className="flex-1 px-4 py-3 text-sm text-zinc-400">取消</button>}
                    <button type="submit" className="flex-1 btn-primary py-3">确定</button>
                </div>
            </form>
        </Modal>
    );
};

// ================= Join Room =================
export const JoinRoomDialog: React.FC<{ targetRoom: any; onClose: () => void; onJoinSuccess: () => void }> = ({ targetRoom, onClose, onJoinSuccess }) => {
    const { joinRoom, showToast } = useStore();
    const [pw, setPw] = useState('');
    const [loading, setLoading] = useState(false);
    if (!targetRoom) return null;
    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await joinRoom(targetRoom.id, pw);
            showToast('成功加入房间', 'success');
            onJoinSuccess();
        } catch (e: any) {
            showToast(e.message === 'Incorrect password' ? '密码错误' : '加入失败', 'error');
        } finally { setLoading(false); }
    };
    return (
        <Modal isOpen={!!targetRoom} onClose={onClose} width="max-w-sm">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0"><Lock className="w-5 h-5 text-emerald-400" /></div>
                <div className="flex flex-col min-w-0"><h2 className="text-lg font-semibold">私密房间</h2><p className="text-xs text-zinc-400 truncate">{targetRoom.name}</p></div>
            </div>
            <form onSubmit={handleJoin} className="space-y-4">
                <input type="password" value={pw} onChange={e => setPw(e.target.value)} required autoFocus placeholder="请输入房间密码" className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-center tracking-widest" />
                <div className="flex gap-3">
                    <button type="button" onClick={onClose} className="flex-1 text-zinc-400">取消</button>
                    <button type="submit" disabled={loading} className="flex-1 bg-emerald-500 text-zinc-950 py-2.5 rounded-lg font-bold">{loading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '进入房间'}</button>
                </div>
            </form>
        </Modal>
    );
};

// ================= Cookie / VIP =================
export const CookieDialog: React.FC<{ isOpen: boolean; onClose: () => void }> = ({ isOpen, onClose }) => {
    const { setCookie, showToast } = useStore();
    const [input, setInput] = useState(() => localStorage.getItem(COOKIE_STORAGE_KEY) || '');
    const [tab, setTab] = useState<'qr' | 'manual'>('manual');
    const [qr, setQr] = useState({ image: '', sig: '', msg: '正在加载...', status: -1 });

    const fetchQr = async () => {
        try {
            const res = await fetch('/api/qqmusic/qrcode');
            const data = await res.json();
            if (data.success) setQr({ ...qr, image: data.image, sig: data.qrsig, msg: '请扫码授权', status: 66 });
        } catch (e) { setQr({ ...qr, msg: '获取失败' }); }
    };

    React.useEffect(() => {
        if (isOpen && tab === 'qr') fetchQr();
        else setQr({ image: '', sig: '', msg: '正在加载...', status: -1 });
    }, [isOpen, tab]);

    React.useEffect(() => {
        let timer: any;
        if (isOpen && tab === 'qr' && qr.sig && qr.status !== 0 && qr.status !== 65) {
            timer = setInterval(async () => {
                const res = await fetch(`/api/qqmusic/qrcode/status?qrsig=${qr.sig}`);
                const data = await res.json();
                if (data.success) {
                    setQr(prev => ({ ...prev, msg: data.message, status: data.status }));
                    if (data.status === 0 && data.cookie) {
                        setCookie(data.cookie);
                        localStorage.setItem(COOKIE_STORAGE_KEY, data.cookie);
                        showToast('授权成功！', 'success');
                        setTimeout(onClose, 1000);
                    }
                }
            }, 2000);
        }
        return () => clearInterval(timer);
    }, [isOpen, tab, qr.sig, qr.status]);

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">🔑 连接授权账号</h2>
                <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">✕</button>
            </div>
            <div className="flex bg-zinc-950 p-1 rounded-xl mb-6">
                <button onClick={() => setTab('manual')} className={`flex-1 py-2 text-sm rounded-lg transition-all ${tab === 'manual' ? 'bg-zinc-800 text-emerald-400 shadow-sm' : 'text-zinc-500'}`}>手动 Cookie</button>
                <button onClick={() => setTab('qr')} className={`flex-1 py-2 text-sm rounded-lg transition-all ${tab === 'qr' ? 'bg-zinc-800 text-emerald-400 shadow-sm' : 'text-zinc-500'}`}>扫码授权</button>
            </div>
            {tab === 'manual' ? (
                <form onSubmit={e => { e.preventDefault(); setCookie(input); localStorage.setItem(COOKIE_STORAGE_KEY, input); onClose(); showToast('保存成功', 'success'); }} className="space-y-4">
                    <textarea
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        className="input-dark w-full h-32 text-xs font-mono"
                        placeholder="在此粘贴 Cookie 字符串... (包含 p_skey 和 qm_keyst 以获得最佳体验)"
                    />
                    <button type="submit" className="w-full btn-primary py-3">确认提交</button>
                </form>
            ) : (
                <div className="flex flex-col items-center py-4 text-center">
                    <div className="relative p-2 bg-white rounded-xl mb-6">
                        {qr.image ? <img src={qr.image} className="w-48 h-48 rounded-lg" /> : <div className="w-48 h-48 bg-zinc-100 flex items-center justify-center text-zinc-400 text-xs">加载中...</div>}
                        {qr.status === 65 && <div onClick={fetchQr} className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center rounded-xl cursor-pointer text-white font-bold"><RefreshCw className="w-8 h-8 mb-2" />刷新</div>}
                    </div>
                    <p className="font-bold text-sm text-zinc-200 mb-2">{qr.msg}</p>
                </div>
            )}
        </Modal>
    );
};
// ================= Global Toast / Notification =================
export const GlobalToast: React.FC = () => {
    const { toast, clearToast } = useStore();
    return (
        <AnimatePresence>
            {toast && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                        className={`px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-xl border flex items-center gap-3 ${toast.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' :
                            toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
                                'bg-zinc-900/80 border-zinc-800 text-zinc-300'
                            }`}
                    >
                        <span className="text-sm font-bold">{toast.message}</span>
                        <button onClick={clearToast} className="p-1 hover:bg-white/10 rounded-full transition-colors pointer-events-auto">✕</button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export const SystemNotificationBubbles: React.FC = () => {
    const { chat } = useStore();
    const [activeIds, setActiveIds] = React.useState<number[]>([]);

    React.useEffect(() => {
        const now = Date.now();
        // 找出最近 5 秒内产生的新系统消息
        const newSystemMsgs = chat.filter(m =>
            m.type === 'system' &&
            !activeIds.includes(m.id) &&
            (now - m.id < 5000) // 确保不是历史遗留消息
        ).slice(-3);

        if (newSystemMsgs.length > 0) {
            const ids = newSystemMsgs.map(m => m.id);
            setActiveIds(prev => [...prev, ...ids]);

            ids.forEach(id => {
                setTimeout(() => {
                    setActiveIds(prev => prev.filter(activeId => activeId !== id));
                }, 5000);
            });
        }
    }, [chat]);

    const visibleMsgs = chat.filter(m => activeIds.includes(m.id));

    return (
        <div className="fixed top-24 right-6 flex flex-col gap-2 z-40 pointer-events-none items-end">
            <AnimatePresence mode="popLayout">
                {visibleMsgs.map((msg) => (
                    <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, x: 20, scale: 0.8 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.5, transition: { duration: 0.2 } }}
                        className="px-4 py-2 bg-zinc-900/60 backdrop-blur-md border border-zinc-800/50 rounded-2xl shadow-lg flex items-center gap-2 max-w-[280px]"
                    >
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[11px] font-bold text-zinc-300 truncate">{msg.text}</span>
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
};
