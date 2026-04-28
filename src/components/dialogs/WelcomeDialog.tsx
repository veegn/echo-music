import React, { useState } from 'react';
import { UserCircle } from 'lucide-react';
import { useStore } from '../../store';
import Modal from './Modal';

export default function WelcomeDialog({
    isOpen,
    onClose,
    initialName,
}: {
    isOpen: boolean;
    onClose: () => void;
    initialName?: string;
}) {
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
            <h2 className="text-2xl font-bold text-center mb-2">欢迎来到 Echo Music</h2>
            <p className="text-zinc-400 text-center text-sm mb-8">开始之前，请告诉我们你的昵称</p>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="relative">
                    <input
                        autoFocus
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="输入你的昵称"
                        className="input-dark w-full text-center text-lg py-3"
                        maxLength={15}
                    />
                </div>
                <button
                    type="submit"
                    disabled={!name.trim()}
                    className="w-full btn-primary py-3 rounded-xl font-bold text-lg shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                    开启音乐之旅
                </button>
            </form>
        </Modal>
    );
}
