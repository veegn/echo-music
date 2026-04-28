import React, { useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { useStore } from '../../store';
import Modal from './Modal';

export default function JoinRoomDialog({
    targetRoom,
    onClose,
    onJoinSuccess,
}: {
    targetRoom: any;
    onClose: () => void;
    onJoinSuccess: () => void;
}) {
    const { joinRoom, showToast } = useStore();
    const [pw, setPw] = useState('');
    const [loading, setLoading] = useState(false);

    if (!targetRoom) return null;

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            await joinRoom(targetRoom.id, pw);
            showToast('加入房间成功', 'success');
            onJoinSuccess();
        } catch (error: any) {
            showToast(error.message === 'Incorrect password' ? '房间密码错误' : '加入房间失败', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal isOpen={!!targetRoom} onClose={onClose} width="max-w-sm">
            <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center shrink-0">
                    <Lock className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex flex-col min-w-0">
                    <h2 className="text-lg font-semibold">加入私密房间</h2>
                    <p className="text-xs text-zinc-400 truncate">{targetRoom.name}</p>
                </div>
            </div>
            <form onSubmit={handleJoin} className="space-y-4">
                <input
                    type="password"
                    autoFocus
                    value={pw}
                    onChange={(e) => setPw(e.target.value)}
                    placeholder="请输入房间密码"
                    className="input-dark w-full"
                />
                <div className="flex gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white"
                    >
                        取消
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="flex-1 btn-primary px-4 py-2.5 rounded-lg flex items-center justify-center gap-2"
                    >
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : '加入'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
