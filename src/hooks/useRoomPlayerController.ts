import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

export function useRoomPlayerController() {
  const { room, skipSong, syncPlayer, controlPlayback, seekPlayer, socket } = useStore();
  const [audioUrl, setAudioUrl] = useState('');
  const [localCurrentTime, setLocalCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [songLoading, setSongLoading] = useState(false);
  const [needsAudioActivation, setNeedsAudioActivation] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastSyncRef = useRef(0);
  const suppressSyncRef = useRef(false);
  const takeoverTimeoutRef = useRef(0);
  const isSyncLeader = !!room?.syncLeaderId && room.syncLeaderId === socket?.id;

  const releaseSuppressSyncSoon = () => {
    window.setTimeout(() => {
      suppressSyncRef.current = false;
    }, 250);
  };

  const playWithActivationTracking = async () => {
    if (!audioRef.current) return false;

    try {
      await audioRef.current.play();
      setNeedsAudioActivation(false);
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[Player] audio playback requires user activation or failed to start:', error);
      }
      setNeedsAudioActivation(true);
      return false;
    }
  };

  useEffect(() => {
    const unlockAudio = () => {
      if (audioRef.current && !audioRef.current.src) {
        const originalSrc = audioRef.current.src;
        // Tiny 0.1s silent MP3 base64 to forcefully unlock Safari audio engine
        audioRef.current.src = 'data:audio/mp3;base64,//OExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';
        audioRef.current.play().then(() => {
          audioRef.current?.pause();
          if (audioRef.current) audioRef.current.src = originalSrc;
        }).catch(() => {
          if (audioRef.current) audioRef.current.src = originalSrc;
        });
      }
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
    document.addEventListener('click', unlockAudio, { once: true });
    document.addEventListener('touchstart', unlockAudio, { once: true });
    return () => {
      document.removeEventListener('click', unlockAudio);
      document.removeEventListener('touchstart', unlockAudio);
    };
  }, []);

  useEffect(() => {
    if (room) {
      setLocalCurrentTime(room.currentTime);
    }
  }, [room?.currentTime]);

  useEffect(() => {
    if (room?.currentSong) {
      if (room.currentSong.playUrl) {
        setAudioUrl(room.currentSong.playUrl);
        setSongLoading(false);
      } else {
        setAudioUrl('');
        setSongLoading(true);
      }
    } else {
      setAudioUrl('');
      setSongLoading(false);
      setNeedsAudioActivation(false);
    }
  }, [room?.currentSong?.songmid, room?.currentSong?.playUrl]);

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setLocalCurrentTime(audioRef.current.currentTime);
    }

    if (isSyncLeader && audioRef.current) {
      const now = Date.now();
      if (now - lastSyncRef.current > 1000) {
        syncPlayer(audioRef.current.currentTime, !audioRef.current.paused);
        lastSyncRef.current = now;
      }
    }
  };

  useEffect(() => {
    let timer: number;
    if (isSyncLeader) {
      timer = window.setInterval(() => {
        if (audioRef.current) {
          const now = Date.now();
          if (now - lastSyncRef.current > 3000) {
            syncPlayer(audioRef.current.currentTime, !audioRef.current.paused);
            lastSyncRef.current = now;
          }
        }
      }, 2000);
    }
    return () => window.clearInterval(timer);
  }, [isSyncLeader, syncPlayer]);

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const togglePlay = () => {
    if (!audioRef.current) return;

    const nextIsPlaying = audioRef.current.paused;
    takeoverTimeoutRef.current = Date.now() + 1500;
    suppressSyncRef.current = true;

    if (nextIsPlaying) {
      void playWithActivationTracking();
    } else {
      audioRef.current.pause();
      setNeedsAudioActivation(false);
    }

    controlPlayback(audioRef.current.currentTime, nextIsPlaying);
    releaseSuppressSyncSoon();
  };

  const handlePlayPause = () => {
    if (audioRef.current && !suppressSyncRef.current) {
      if (!isSyncLeader) {
        takeoverTimeoutRef.current = Date.now() + 1500;
        controlPlayback(audioRef.current.currentTime, !audioRef.current.paused);
      } else {
        syncPlayer(audioRef.current.currentTime, !audioRef.current.paused);
      }
    }
  };

  useEffect(() => {
    if (!isSyncLeader && audioRef.current && room) {
      if (Date.now() < takeoverTimeoutRef.current) return;
      const diff = Math.abs(audioRef.current.currentTime - room.currentTime);
      suppressSyncRef.current = true;
      if (diff > 0.8 && audioRef.current.readyState >= 2) {
        audioRef.current.currentTime = room.currentTime;
      }

      if (room.isPlaying && audioRef.current.paused && !audioRef.current.ended) {
        void playWithActivationTracking();
      } else if (!room.isPlaying && !audioRef.current.paused) {
        audioRef.current.pause();
        setNeedsAudioActivation(false);
      }

      releaseSuppressSyncSoon();
    }
  }, [room?.currentSong?.songmid, room?.currentTime, room?.isPlaying, room?.syncVersion, isSyncLeader]);

  useEffect(() => {
    if (audioRef.current && room?.currentSong && isSyncLeader) {
      setSongLoading(true);
      playWithActivationTracking()
        .finally(() => {
          setSongLoading(false);
        });
    }
  }, [audioUrl, isSyncLeader, room?.currentSong?.songmid]);

  const handleSeek = (nextTime: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = nextTime;
    takeoverTimeoutRef.current = Date.now() + 500;
    seekPlayer(nextTime);
  };

  const handleSkip = (isAuto: boolean = false) => {
    takeoverTimeoutRef.current = Date.now() + 500;
    skipSong(isAuto);
  };

  const activateAudio = () => {
    if (!audioRef.current) return;
    void playWithActivationTracking();
  };

  return {
    room,
    audioUrl,
    localCurrentTime,
    duration,
    songLoading,
    needsAudioActivation,
    audioRef,
    isSyncLeader,
    handleTimeUpdate,
    handleLoadedMetadata,
    handlePlayPause,
    togglePlay,
    handleSeek,
    handleSkip,
    activateAudio,
  };
}
