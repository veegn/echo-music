import React, { useState } from 'react';
import { useStore } from '../store';

export default function ChatBox() {
    const { chat, sendMessage } = useStore();
    const [input, setInput] = useState('');

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        sendMessage(input);
        setInput('');
    };

    return (
        <div className="flex flex-col h-full border border-zinc-800/50 rounded-xl bg-zinc-900/30 overflow-hidden">
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {chat.map((msg, i) => (
                    <div key={msg.id || i} className={`text-sm ${msg.type === 'system' ? 'text-zinc-500 text-center text-xs' : ''}`}>
                        {msg.type === 'user' && <span className="font-medium text-emerald-400 mr-2">{msg.userName}:</span>}
                        <span className={msg.type === 'user' ? 'text-zinc-300' : ''}>{msg.text}</span>
                    </div>
                ))}
            </div>
            <form onSubmit={handleSend} className="p-2 border-t border-zinc-800/50 bg-zinc-900/50">
                <input
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    placeholder="输入消息..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-emerald-500/50 transition-colors"
                />
            </form>
        </div>
    );
}
