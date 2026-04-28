import React from 'react';
import { motion } from 'framer-motion';

interface ProgressBarProps {
  currentTime: number;
  duration: number;
  onSeek: (time: number) => void;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ currentTime, duration, onSeek }) => {
  const seekFromPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(percent * duration);
  };

  return (
    <div className="flex items-center gap-3 mb-6">
      <span className="text-xs text-zinc-500 font-mono w-10 text-right shrink-0">
        {Math.floor(currentTime / 60)}:{(Math.floor(currentTime) % 60).toString().padStart(2, '0')}
      </span>
      <div
        className="flex-1 h-3 bg-zinc-800 rounded-full overflow-hidden relative cursor-pointer touch-none my-4"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          seekFromPointer(e);
        }}
        onPointerMove={(e) => {
          if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
          seekFromPointer(e);
        }}
        onPointerUp={(e) => {
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId);
          }
        }}
      >
        <motion.div
          className="absolute top-0 left-0 h-full bg-emerald-500 rounded-full"
          style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
          layout
        />
      </div>
      <span className="text-xs text-zinc-500 font-mono w-10 text-left shrink-0">
        {Math.floor(duration / 60)}:{(Math.floor(duration) % 60).toString().padStart(2, '0')}
      </span>
    </div>
  );
};

export default ProgressBar;
