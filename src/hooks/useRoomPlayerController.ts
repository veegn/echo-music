import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

function findFirstHttpUrl(obj: unknown): string | null {
  if (!obj || typeof obj !== 'object') return null;
  for (const val of Object.values(obj as Record<string, unknown>)) {
    if (typeof val === 'string' && val.startsWith('http')) return val;
    const nested = findFirstHttpUrl(val);
    if (nested) return nested;
  }
  return null;
}

export function useRoomPlayerController() {
  const { room, skipSong, syncPlayer, controlPlayback, seekPlayer, showToast, socket } = useStore();
  const [audioUrl, setAudioUrl] = useState('');
  const [localCurrentTime, setLocalCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [songLoading, setSongLoading] = useState(false);
  const [autoPlayFailed, setAutoPlayFailed] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastSyncRef = useRef(0);
  const suppressSyncRef = useRef(false);
  const takeoverTimeoutRef = useRef(0);
  const isSyncLeader = !!room?.syncLeaderId && room.syncLeaderId === socket?.id;

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
        setAutoPlayFailed(false);
      } else {
        setAudioUrl('');
        setSongLoading(true);
      }
    } else {
      setAudioUrl('');
      setSongLoading(false);
      setAutoPlayFailed(false);
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
      if (!isSyncLeader && room?.currentTime && room.currentTime > 1) {
        audioRef.current.currentTime = room.currentTime;
      }
    }
  };

  const togglePlay = () => {
    if (audioRef.current) {
      const nextIsPlaying = audioRef.current.paused;
      takeoverTimeoutRef.current = Date.now() + 1500;
      suppressSyncRef.current = true;
      if (nextIsPlaying) {
        audioRef.current.play().catch(() => setAutoPlayFailed(true));
      } else {
        audioRef.current.pause();
      }
      controlPlayback(audioRef.current.currentTime, nextIsPlaying);
      window.setTimeout(() => {
        suppressSyncRef.current = false;
      }, 0);
    }
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
      if (diff > 0.8) audioRef.current.currentTime = room.currentTime;

      if (room.isPlaying && audioRef.current.paused && !audioRef.current.ended) {
        audioRef.current.play()
          .then(() => setAutoPlayFailed(false))
          .catch(() => setAutoPlayFailed(true));
      } else if (!room.isPlaying && !audioRef.current.paused) {
        audioRef.current.pause();
        setAutoPlayFailed(false);
      }
      window.setTimeout(() => {
        suppressSyncRef.current = false;
      }, 0);
    }
  }, [room?.currentTime, room?.isPlaying, isSyncLeader, room]);

  useEffect(() => {
    if (audioRef.current && room?.currentSong && isSyncLeader) {
      setSongLoading(true);
      audioRef.current.play()
        .then(() => {
          setSongLoading(false);
          setAutoPlayFailed(false);
        })
        .catch(() => {
          setSongLoading(false);
          setAutoPlayFailed(true);
          showToast('浏览器拦截了自动播放，请手动点击播放。', 'error');
        });
    }
  }, [audioUrl, isSyncLeader, room?.currentSong, showToast]);

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

  const retryAutoplay = () => {
    audioRef.current?.play()
      .then(() => setAutoPlayFailed(false))
      .catch(() => { });
  };

  return {
    room,
    audioUrl,
    localCurrentTime,
    duration,
    songLoading,
    autoPlayFailed,
    audioRef,
    isSyncLeader,
    handleTimeUpdate,
    handleLoadedMetadata,
    handlePlayPause,
    togglePlay,
    handleSeek,
    handleSkip,
    retryAutoplay,
  };
}
