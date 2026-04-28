import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store';

export default function SystemNotificationBubbles() {
    const { chat } = useStore();
    const [activeIds, setActiveIds] = useState<number[]>([]);

    useEffect(() => {
        const now = Date.now();
        const newSystemMsgs = chat.filter((m) => m.type === 'system' && !activeIds.includes(m.id) && now - m.id < 5000).slice(-3);

        if (newSystemMsgs.length > 0) {
            const ids = newSystemMsgs.map((m) => m.id);
            setActiveIds((prev) => [...prev, ...ids]);
            ids.forEach((id) => {
                setTimeout(() => {
                    setActiveIds((prev) => prev.filter((activeId) => activeId !== id));
                }, 5000);
            });
        }
    }, [activeIds, chat]);

    const visibleMsgs = chat.filter((m) => activeIds.includes(m.id));

    return (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 md:right-6 flex flex-col gap-2 z-40 pointer-events-none items-center md:items-end w-[calc(100%-2rem)] md:w-auto">
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
}
