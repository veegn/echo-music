import React from 'react';
import { motion } from 'framer-motion';

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    width?: string;
    zIndex?: string;
}

const Modal: React.FC<ModalProps> = ({ isOpen, children, width = 'max-w-md', zIndex = 'z-50' }) => {
    if (!isOpen) return null;

    return (
        <div className={`fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center ${zIndex} p-4 pt-[calc(1rem_+_env(safe-area-inset-top))] pb-[calc(1rem_+_env(safe-area-inset-bottom))]`}>
            <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                className={`bg-zinc-900 border border-zinc-800 rounded-2xl p-6 w-full ${width} max-h-[calc(100dvh_-_2rem_-_env(safe-area-inset-top)_-_env(safe-area-inset-bottom))] overflow-y-auto shadow-2xl relative`}
            >
                {children}
            </motion.div>
        </div>
    );
};

export default Modal;
