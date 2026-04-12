import React, { useState } from 'react';
import { CookieDialog } from './Dialogs';
import PlayerView from './PlayerView';
import { useRoomPlayerController } from '../hooks/useRoomPlayerController';

export default function Player({ isHost }: { isHost: boolean }) {
  const [showCookieDialog, setShowCookieDialog] = useState(false);
  const controller = useRoomPlayerController();

  return (
    <>
      <PlayerView
        room={controller.room}
        isHost={isHost}
        audioUrl={controller.audioUrl}
        audioRef={controller.audioRef}
        localCurrentTime={controller.localCurrentTime}
        duration={controller.duration}
        isSyncLeader={controller.isSyncLeader}
        onTogglePlay={controller.togglePlay}
        onSkip={controller.handleSkip}
        onOpenCookieDialog={() => setShowCookieDialog(true)}
        onTimeUpdate={controller.handleTimeUpdate}
        onLoadedMetadata={controller.handleLoadedMetadata}
        onPlayPause={controller.handlePlayPause}
        onSeek={controller.handleSeek}
      />
      <CookieDialog isOpen={showCookieDialog} onClose={() => setShowCookieDialog(false)} />
    </>
  );
}
