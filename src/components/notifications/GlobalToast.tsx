import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../../store';

export default function GlobalToast() {
    const { toast, clearToast } = useStore();

    return (
        <AnimatePresence>
            {toast && (
                <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] pointer-events-none">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`px-6 py-3 rounded-2xl shadow-2xl backdrop-blur-xl border flex items-center gap-3 ${toast.type === 'error' ? 'bg-red-500/10 border-red-500/30 text-red-400' : toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-zinc-900/80 border-zinc-800 text-zinc-300'}`}
                    >
                        <span className="text-sm font-bold">{toast.message}</span>
                        <button onClick={clearToast} className="p-1 hover:bg-white/10 rounded-full transition-colors pointer-events-auto">
                            关闭
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
