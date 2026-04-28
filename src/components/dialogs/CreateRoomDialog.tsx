import React from 'react';
import { useStore } from '../../store';
import Modal from './Modal';

export default function CreateRoomDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { userName, joinRoom, showToast } = useStore();

    const handleCreateRoom = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const name = String(formData.get('roomName') || '');
        const password = String(formData.get('password') || '');

        try {
            const res = await fetch('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, password, hostName: userName }),
            });
            const data = await res.json();
            if (!res.ok || !data?.id) {
                throw new Error(data?.error || '创建房间失败');
            }
            await joinRoom(data.id, password);
            showToast('房间创建成功', 'success');
            onClose();
        } catch (err) {
            showToast('房间创建失败', 'error');
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <h2 className="text-xl font-semibold mb-6">创建房间</h2>
            <form onSubmit={handleCreateRoom} className="space-y-4">
                <input name="roomName" required placeholder="输入房间名称" className="input-dark w-full" />
                <input name="password" type="password" placeholder="设置密码（可选）" className="input-dark w-full" />
                <div className="flex gap-3 pt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-zinc-400 hover:text-white"
                    >
                        取消
                    </button>
                    <button type="submit" className="flex-1 btn-primary px-4 py-2.5 rounded-lg">
                        创建
                    </button>
                </div>
            </form>
        </Modal>
    );
}
