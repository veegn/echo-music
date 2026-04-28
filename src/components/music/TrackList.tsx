import React from 'react';
import { Radio } from 'lucide-react';
import TrackItem from './TrackItem';

interface TrackListProps {
  tracks: any[];
  showPlayAll?: boolean;
  isHost?: boolean;
  onAddSong: (song: any) => void;
  onPlayAll?: (songs: any[]) => void;
}

const TrackList: React.FC<TrackListProps> = ({ 
  tracks, 
  showPlayAll = false, 
  isHost = false, 
  onAddSong, 
  onPlayAll 
}) => {
  return (
    <div className="space-y-1">
      {showPlayAll && tracks.length > 0 && isHost && onPlayAll && (
        <button
          onClick={() => onPlayAll(tracks)}
          className="w-full py-2.5 mb-2 btn-primary text-xs flex items-center justify-center gap-2"
        >
          <Radio className="w-4 h-4" />
          一键播放全部
        </button>
      )}
      {tracks.map((song) => (
        <TrackItem 
          key={song.songmid || song.id} 
          song={song} 
          onAdd={onAddSong} 
        />
      ))}
    </div>
  );
};

export default TrackList;
