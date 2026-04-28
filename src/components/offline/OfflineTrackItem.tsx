import React from "react";

type OfflineTrack = {
  songmid: string;
  songname: string;
  singer: string;
  albumname: string;
  audioSize: number;
  coverUrl: string;
};

const formatSize = (size: number) => {
  if (!size) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

interface OfflineTrackItemProps {
  track: OfflineTrack;
  isSelected: boolean;
  onToggleSelection: () => void;
  onSelect: () => void;
}

const OfflineTrackItem: React.FC<OfflineTrackItemProps> = ({
  track,
  isSelected,
  onToggleSelection,
  onSelect,
}) => {
  return (
    <div
      className="flex items-center gap-3 rounded-[24px] border border-zinc-800/60 bg-zinc-900/45 px-4 py-3 transition-all hover:border-emerald-500/25 hover:bg-zinc-900/85"
    >
      <label className="flex shrink-0 items-center cursor-pointer">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={onToggleSelection}
          className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-emerald-500 focus:ring-emerald-500/40"
        />
      </label>
      <button
        onClick={onSelect}
        className="min-w-0 flex-1 text-left"
      >
        <div className="flex items-center gap-4">
          <img
            src={track.coverUrl}
            alt={track.songname}
            className="h-16 w-16 rounded-2xl bg-zinc-900 object-cover shadow-lg"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-zinc-100">{track.songname}</div>
            <div className="mt-1 truncate text-xs text-zinc-400">{track.singer}</div>
            <div className="mt-1 truncate text-[11px] text-zinc-500">{track.albumname}</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-xs font-semibold text-zinc-300">{formatSize(track.audioSize)}</div>
            <div className="mt-1 text-[11px] text-zinc-500">点击播放</div>
          </div>
        </div>
      </button>
    </div>
  );
};

export default OfflineTrackItem;
