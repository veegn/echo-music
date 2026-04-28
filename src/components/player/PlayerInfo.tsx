import React from 'react';
import { motion } from 'framer-motion';
import { formatSinger } from '../../utils/music';
import { RoomState } from '../../types';

interface PlayerInfoProps {
  currentSong: RoomState['currentSong'];
}

export default function PlayerInfo({ currentSong }: PlayerInfoProps) {
  return (
    <div className="mb-4 md:mb-6 mt-1 md:mt-0 min-h-[60px] md:min-h-[80px] flex flex-col justify-center">
      <h2 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 md:mb-2 tracking-tight text-white line-clamp-2 leading-tight text-center md:text-left">
        {currentSong ? currentSong.songname : '还没有开始播放'}
      </h2>
      <p className="text-zinc-400 text-[13px] md:text-sm font-medium line-clamp-1 text-center md:text-left">
        {currentSong ? formatSinger(currentSong.singer) : '去右侧搜索歌曲，或者从歌单里挑一首开始吧。'}
      </p>
    </div>
  );
}
