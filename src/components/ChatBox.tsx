import React, { useState, useEffect, useRef } from 'react';
import { useStore } from '../store';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, MessageSquare } from 'lucide-react';

export default function ChatBox() {
    const { chat, sendMessage, room } = useStore();
    const [input, setInput] = useState('');
    const scrollRef = useRef<HTMLDivElement>(null);

    // Filter chat to only show user messages and simple join/leave system messages
    // The "Bubbles" will handle the more important system messages
    const userMessages = chat.filter(m => m.type === 'user');

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;
        sendMessage(input);
        setInput('');
    };

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [chat]);

    return (
        <div className="flex flex-col h-full bg-transparent overflow-hidden">
            {/* User Messages History */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
            >
                {chat.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center opacity-30 select-none pb-10">
                        <MessageSquare className="w-10 h-10 mb-3 text-zinc-500" />
                        <span className="text-sm font-medium text-zinc-400">大厅很安静，来一句吧</span>
                    </div>
                )}
                {chat.map((msg, i) => (
                    <div key={msg.id || i} className={`flex flex-col ${msg.type === 'system' ? 'items-center py-2' : 'items-start'} transition-opacity`}>
                        {msg.type === 'user' ? (
                            <div className="max-w-[90%]">
                                <span className="text-[10px] font-bold text-zinc-500 mb-0.5 ml-1 tracking-wide">{msg.userName}</span>
                                <div className="bg-zinc-800/80 border border-zinc-700/50 rounded-xl sm:rounded-2xl rounded-tl-sm px-3 py-2 sm:px-3.5 sm:py-2.5 text-[13px] sm:text-[14px] leading-relaxed text-zinc-200 shadow-sm backdrop-blur-sm">
                                    {msg.text}
                                </div>
                            </div>
                        ) : (
                            <div className="px-3 py-0.5 sm:px-3.5 sm:py-1 rounded-full bg-zinc-900/50 border border-zinc-800 text-[10px] sm:text-[11px] font-medium tracking-wide text-zinc-500">
                                {msg.text}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Input at Bottom */}
            <form onSubmit={handleSend} className="p-3 border-t border-zinc-800/50 bg-zinc-900/40 backdrop-blur-md">
                <div className="relative flex items-center gap-2">
                    <input
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder="说点什么..."
                        className="input-dark flex-1 shadow-inner"
                    />
                    <button
                        type="submit"
                        disabled={!input.trim()}
                        className="p-2.5 btn-primary disabled:bg-zinc-800 disabled:text-zinc-500 disabled:shadow-none shrink-0"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
            </form>
        </div>
    );
}
