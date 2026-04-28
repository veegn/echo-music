import React from 'react';
import { MessageSquare, Users, ListMusic } from 'lucide-react';

interface MobileNavProps {
  activeTab: 'none' | 'chat' | 'users' | 'music';
  onTabChange: (tab: 'none' | 'chat' | 'users' | 'music') => void;
  unreadCount: number;
  memberCount: number;
}

export default function MobileNav({ activeTab, onTabChange, unreadCount, memberCount }: MobileNavProps) {
  return (
    <nav className="lg:hidden shrink-0 min-h-[calc(4rem_+_env(safe-area-inset-bottom))] bg-zinc-900/90 backdrop-blur-2xl border-t border-zinc-800 flex items-center justify-around px-4 pt-2 pb-[calc(0.5rem_+_env(safe-area-inset-bottom))] z-50 shadow-[0_-10px_25px_rgba(0,0,0,0.5)]">
      <button
        onClick={() => onTabChange(activeTab === 'chat' ? 'none' : 'chat')}
        className={`relative flex flex-col items-center gap-1 transition-all ${activeTab === 'chat' ? 'text-emerald-400 scale-110' : 'text-zinc-500'}`}
      >
        <MessageSquare className={`w-5 h-5 ${activeTab === 'chat' ? 'fill-emerald-400/20' : ''}`} />
        <span className="text-[10px] font-bold">聊天</span>
        {unreadCount > 0 && activeTab !== 'chat' && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-[10px] flex items-center justify-center rounded-full text-white font-bold animate-bounce shadow-lg shadow-red-500/30">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      <button
        onClick={() => onTabChange(activeTab === 'users' ? 'none' : 'users')}
        className={`relative flex flex-col items-center gap-1 transition-all ${activeTab === 'users' ? 'text-emerald-400 scale-110' : 'text-zinc-500'}`}
      >
        <Users className={`w-5 h-5 ${activeTab === 'users' ? 'fill-emerald-400/20' : ''}`} />
        <span className="text-[10px] font-bold">听众</span>
        <span className="absolute -top-1 -right-1.5 px-1 min-w-[14px] h-3.5 bg-zinc-800 text-[8px] flex items-center justify-center rounded-full text-zinc-400 font-bold border border-zinc-700">
          {memberCount}
        </span>
      </button>
      <button
        onClick={() => onTabChange(activeTab === 'music' ? 'none' : 'music')}
        className={`relative flex flex-col items-center gap-1 transition-all ${activeTab === 'music' ? 'text-emerald-400 scale-110' : 'text-zinc-500'}`}
      >
        <ListMusic className={`w-5 h-5 ${activeTab === 'music' ? 'fill-emerald-400/20' : ''}`} />
        <span className="text-[10px] font-bold">曲库</span>
      </button>
    </nav>
  );
}
