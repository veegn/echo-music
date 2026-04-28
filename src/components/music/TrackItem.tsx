import React from 'react';
import { Plus } from 'lucide-react';
import { formatSinger } from '../../utils/music';

interface TrackItemProps {
  song: any;
  onAdd: (song: any) => void;
}

const TrackItem: React.FC<TrackItemProps> = ({ song, onAdd }) => {
  return (
    <div className="group flex items-center justify-between p-2.5 sm:p-3 list-item-hover">
      <div className="flex flex-col min-w-0 flex-1 pr-3">
        <span className="text-[13px] sm:text-sm font-medium text-zinc-100 truncate">{song.songname}</span>
        <span className="text-[11px] sm:text-xs text-zinc-500 truncate">{formatSinger(song.singer)}</span>
      </div>
      <button
        onClick={() => onAdd(song)}
        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 hover:border hover:border-emerald-500/30 transition-all shrink-0 md:opacity-0 md:group-hover:opacity-100"
        title="点歌"
      >
        <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
      </button>
    </div>
  );
};

export default TrackItem;
