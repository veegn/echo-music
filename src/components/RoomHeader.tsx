import React from 'react';
import { LoaderCircle, LogOut, Trash2, WifiOff } from 'lucide-react';
import { RoomState } from '../types';

interface RoomHeaderProps {
  room: RoomState | null;
  connectionState: string;
  isHost: boolean;
  onLeave: () => void;
  onDelete?: () => void;
}

export default function RoomHeader({ 
  room, 
  connectionState, 
  isHost, 
  onLeave, 
  onDelete 
}: RoomHeaderProps) {
  return (
    <header className="shrink-0 min-h-[calc(3.5rem_+_env(safe-area-inset-top))] sm:min-h-[calc(4rem_+_env(safe-area-inset-top))] pt-safe glass-panel z-40 px-3 sm:px-6 flex items-center justify-between shadow-xl">
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex flex-col flex-1 min-w-0">
          <h2 className="font-extrabold text-lg sm:text-xl tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 to-zinc-400 truncate leading-tight">
            {room?.name}
          </h2>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
            <span className="flex items-center gap-1.5 bg-zinc-800/40 px-1.5 py-0.5 rounded border border-zinc-700/30">
              <span className="text-zinc-500 text-[10px] sm:text-xs tracking-tighter">房主</span>
              <span className="text-zinc-300 font-medium truncate max-w-[80px] sm:max-w-[120px]">{room?.hostName}</span>
            </span>
            {room?.hostQQId && (
              <span className="text-emerald-400 flex items-center gap-1.5 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 max-w-[100px] sm:max-w-none truncate">
                <span className="inline-block w-1 h-1 sm:w-1.5 sm:h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                QQ: {room.hostQQId}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg bg-zinc-900/80 border border-zinc-800 shadow-sm">
          {connectionState === 'connected' && (
            <>
              <div className="relative flex h-2 w-2 mr-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </div>
              <span className="text-zinc-300">已连接</span>
            </>
          )}
          {connectionState === 'connecting' && (
            <>
              <LoaderCircle className="w-3.5 h-3.5 text-amber-400 animate-spin" />
              <span className="text-zinc-300">重连中...</span>
            </>
          )}
          {connectionState === 'disconnected' && (
            <>
              <WifiOff className="w-3.5 h-3.5 text-red-400" />
              <span className="text-zinc-300">未连接</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isHost && onDelete && (
            <button
              onClick={onDelete}
              className="hidden sm:flex p-2 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 transition-all border border-transparent hover:border-red-500/20"
              title="删除房间"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
          <button
            onClick={onLeave}
            className="flex items-center gap-2 sm:px-4 sm:py-2 p-2 rounded-xl bg-zinc-800 hover:bg-red-600/90 text-zinc-300 hover:text-white font-semibold text-sm transition-all border border-zinc-700/50 hover:border-red-500/50 group"
          >
            <LogOut className="w-5 h-5 sm:w-4 sm:h-4 group-hover:translate-x-1 transition-transform" />
            <span className="hidden sm:inline">退出房间</span>
          </button>
        </div>
      </div>
    </header>
  );
}
