import React, { useState } from 'react';
import CookieDialog from './dialogs/CookieDialog';
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
        needsAudioActivation={controller.needsAudioActivation}
        onTogglePlay={controller.togglePlay}
        onSkip={controller.handleSkip}
        onOpenCookieDialog={() => setShowCookieDialog(true)}
        onActivateAudio={controller.activateAudio}
        onTimeUpdate={controller.handleTimeUpdate}
        onLoadedMetadata={controller.handleLoadedMetadata}
        onPlayPause={controller.handlePlayPause}
        onEnded={controller.handleEnded}
        onSeek={controller.handleSeek}
        audioNextRef={controller.audioNextRef}
      />
      <CookieDialog isOpen={showCookieDialog} onClose={() => setShowCookieDialog(false)} />
    </>
  );
}
