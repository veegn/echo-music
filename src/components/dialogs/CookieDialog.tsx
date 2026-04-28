import React, { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import { useStore } from '../../store';
import Modal from './Modal';

const COOKIE_STORAGE_KEY = 'echo_music_vip_cookie';

export default function CookieDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { room, setRoomState, showToast } = useStore();
    const [tab, setTab] = useState<'qr' | 'manual'>('qr');
    const [input, setInput] = useState('');
    const [saving, setSaving] = useState(false);
    const [qr, setQr] = useState({ image: '', sig: '', msg: '加载中...', status: -1 });

    const fetchQr = async () => {
        setQr({ image: '', sig: '', msg: '加载中...', status: -1 });
        try {
            const res = await fetch('/api/qqmusic/qrcode');
            const data = await res.json();
            if (data.success) {
                setQr((prev) => ({ ...prev, image: data.image, sig: data.qrsig, msg: '请使用 QQ 扫码授权', status: 66 }));
            }
        } catch (err) {
            setQr((prev) => ({ ...prev, msg: '二维码加载失败' }));
        }
    };

    useEffect(() => {
        if (isOpen && tab === 'qr') {
            fetchQr();
        } else {
            setQr({ image: '', sig: '', msg: '加载中...', status: -1 });
        }
    }, [isOpen, tab]);

    useEffect(() => {
        let timer: ReturnType<typeof setInterval> | undefined;
        if (isOpen && tab === 'qr' && qr.sig && qr.status !== 0 && qr.status !== 65) {
            timer = setInterval(async () => {
                const url = new URL('/api/qqmusic/qrcode/status', window.location.origin);
                url.searchParams.set('qrsig', qr.sig);
                if (room?.id) url.searchParams.set('roomId', room.id);

                const res = await fetch(url.toString());
                const data = await res.json();
                if (data.success) {
                    const message = data.status === 66 ? '等待扫描二维码' : data.message;
                    setQr((prev) => ({ ...prev, msg: message, status: data.status }));
                    if (data.status === 0 && data.cookie && data.room) {
                        setRoomState(data.room);
                        localStorage.setItem(COOKIE_STORAGE_KEY, data.cookie);
                        showToast('授权成功', 'success');
                        setTimeout(onClose, 1000);
                    }
                }
            }, 2000);
        }

        return () => {
            if (timer) clearInterval(timer);
        };
    }, [isOpen, onClose, qr.sig, qr.status, room?.id, setRoomState, showToast, tab]);

    const handleManualSave = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const trimmed = input.trim();

        if (!room?.id) {
            showToast('房间不存在，无法保存 Cookie', 'error');
            return;
        }
        if (!trimmed) {
            showToast('Cookie 不能为空', 'error');
            return;
        }

        setSaving(true);
        try {
            const res = await fetch('/api/qqmusic/room-cookie', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ roomId: room.id, cookie: trimmed }),
            });
            const data = await res.json();

            if (!res.ok || !data?.success || !data.room) {
                throw new Error(data?.message || data?.error || 'Cookie 校验失败');
            }

            setRoomState(data.room);
            localStorage.setItem(COOKIE_STORAGE_KEY, trimmed);
            onClose();
            showToast('Cookie 已保存', 'success');
        } catch (error: any) {
            showToast(error?.message || 'Cookie 校验失败', 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">绑定授权账号</h2>
                <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
                    关闭
                </button>
            </div>
            <div className="flex bg-zinc-950 p-1 rounded-xl mb-6">
                <button
                    onClick={() => setTab('qr')}
                    className={`flex-1 py-2 text-sm rounded-lg transition-all ${tab === 'qr' ? 'bg-zinc-800 text-emerald-400 shadow-sm' : 'text-zinc-500'}`}
                >
                    扫码授权
                </button>
                <button
                    onClick={() => setTab('manual')}
                    className={`flex-1 py-2 text-sm rounded-lg transition-all ${tab === 'manual' ? 'bg-zinc-800 text-emerald-400 shadow-sm' : 'text-zinc-500'}`}
                >
                    手动填写 Cookie
                </button>
            </div>
            {tab === 'manual' ? (
                <form onSubmit={handleManualSave} className="space-y-4">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        className="input-dark w-full h-32 text-xs font-mono"
                        placeholder="粘贴 Cookie 字符串，建议至少包含 p_skey 和 qm_keyst"
                    />
                    <button type="submit" disabled={saving} className="w-full btn-primary py-3 disabled:opacity-60">
                        {saving ? '校验中...' : '保存'}
                    </button>
                </form>
            ) : (
                <div className="flex flex-col items-center py-4 text-center">
                    <div className="relative p-2 bg-white rounded-xl mb-6">
                        {qr.image ? (
                            <img src={qr.image} className="w-48 h-48 rounded-lg" />
                        ) : (
                            <div className="w-48 h-48 bg-zinc-100 flex items-center justify-center text-zinc-400 text-xs">
                                加载中...
                            </div>
                        )}
                        {qr.status === 65 && (
                            <div
                                onClick={fetchQr}
                                className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center rounded-xl cursor-pointer text-white font-bold"
                            >
                                <RefreshCw className="w-8 h-8 mb-2" />
                                刷新二维码
                            </div>
                        )}
                    </div>
                    <p className="font-bold text-sm text-zinc-200 mb-2">{qr.msg}</p>
                </div>
            )}
        </Modal>
    );
}
