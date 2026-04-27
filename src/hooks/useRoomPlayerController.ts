import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

// Tiny 0.1s silent MP3 base64 for Safari audio-context unlock
const SILENT_MP3 = 'data:audio/mp3;base64,//OExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq';

export function useRoomPlayerController() {
  const { room, skipSong, syncPlayer, controlPlayback, seekPlayer, socket } = useStore();
  const [audioUrl, setAudioUrl] = useState('');
  const [localCurrentTime, setLocalCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [songLoading, setSongLoading] = useState(false);
  const [needsAudioActivation, setNeedsAudioActivation] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioNextRef = useRef<HTMLAudioElement>(null);
  const preloadedNextMidRef = useRef<string | null>(null);
  const audioUnlockedRef = useRef(false);

  const lastSyncRef = useRef(0);
  const suppressSyncRef = useRef(false);
  const takeoverTimeoutRef = useRef(0);
  const isSyncLeader = !!room?.syncLeaderId && room.syncLeaderId === socket?.id;

  const releaseSuppressSyncSoon = () => {
    window.setTimeout(() => {
      suppressSyncRef.current = false;
    }, 250);
  };

  /**
   * Unlock the audio element in the context of a user gesture.
   * Must be called synchronously from a click/touch handler.
   * After this, the audio element is "blessed" by the browser
   * and subsequent programmatic play() calls will succeed.
   */
  const unlockAudioElement = async (audio: HTMLAudioElement): Promise<void> => {
    if (audioUnlockedRef.current) return;

    // Save the current src so we can restore it without re-triggering a load
    const hadSrc = audio.getAttribute('src');

    // Play a tiny silent MP3 to "bless" this audio element.
    // Use muted instead of volume=0 to avoid iOS volume state issues.
    audio.muted = true;
    audio.src = SILENT_MP3;
    try {
      await audio.play();
      audio.pause();
    } catch {
      // Some browsers may still block; that's OK
    }
    audio.muted = false;

    // Restore the original src attribute (not the resolved property).
    // Setting via attribute avoids triggering a network reload if the
    // value hasn't changed, preventing the decoder pop/glitch.
    if (hadSrc) {
      audio.setAttribute('src', hadSrc);
    } else {
      audio.removeAttribute('src');
      audio.load();
    }

    audioUnlockedRef.current = true;
  };

  const playWithActivationTracking = async () => {
    if (!audioRef.current) return false;

    // Cannot play without a source
    if (!audioRef.current.src || audioRef.current.src === window.location.href) {
      return false;
    }

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

  // Passive unlock: attempt to unlock audio on first user interaction anywhere
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (audioRef.current && !audioUnlockedRef.current) {
        void unlockAudioElement(audioRef.current);
      }
    };
    document.addEventListener('click', handleFirstInteraction, { once: true });
    document.addEventListener('touchend', handleFirstInteraction, { once: true });
    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchend', handleFirstInteraction);
    };
  }, []);

  // Fix #3: Resume audio after iOS suspends the process in background.
  // When Safari freezes a tab, the AudioContext becomes 'suspended'.
  // On return, we need to attempt to resume playback.
  useEffect(() => {
    const handleResume = () => {
      if (document.visibilityState !== 'visible') return;
      if (!audioRef.current || !room?.isPlaying) return;
      // If audio was playing but got paused by OS freeze, resume it
      if (audioRef.current.paused && audioRef.current.src && audioRef.current.readyState >= 2) {
        void playWithActivationTracking();
      }
    };
    document.addEventListener('visibilitychange', handleResume);
    return () => document.removeEventListener('visibilitychange', handleResume);
  }, [room?.isPlaying]);

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

  // Preload next song
  useEffect(() => {
    if (room?.nextSong?.playUrl && audioNextRef.current) {
      if (preloadedNextMidRef.current !== room.nextSong.songmid) {
        audioNextRef.current.src = room.nextSong.playUrl;
        audioNextRef.current.load();
        preloadedNextMidRef.current = room.nextSong.songmid;
      }
    } else if (!room?.nextSong && audioNextRef.current) {
      audioNextRef.current.src = '';
      preloadedNextMidRef.current = null;
    }
  }, [room?.nextSong?.songmid, room?.nextSong?.playUrl]);

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

  const updatePositionState = () => {
    if ('mediaSession' in navigator && audioRef.current && !isNaN(audioRef.current.duration)) {
      try {
        navigator.mediaSession.setPositionState({
          duration: audioRef.current.duration,
          playbackRate: audioRef.current.playbackRate || 1,
          position: audioRef.current.currentTime || 0,
        });
      } catch (e) {}
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
      updatePositionState();
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
    updatePositionState();
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
    updatePositionState();
  };

  const handleSkip = (isAuto: boolean = false) => {
    takeoverTimeoutRef.current = Date.now() + 500;
    skipSong(isAuto);
  };

  const handleEnded = () => {
    if (isSyncLeader) {
      // Dual-audio: If we have a preloaded next song, switch to it.
      if (room?.nextSong && audioNextRef.current && audioNextRef.current.src && audioRef.current) {
        const nextUrl = audioNextRef.current.src;
        const mainAudio = audioRef.current;

        // Reset position to avoid residual seek noise
        mainAudio.currentTime = 0;
        mainAudio.src = nextUrl;

        // Wait for enough data to be decoded before starting playback.
        // This prevents the decoder from outputting garbage frames during
        // the transition, which manifests as a "pop" or distortion.
        const onCanPlay = () => {
          mainAudio.removeEventListener('canplay', onCanPlay);
          void mainAudio.play();
        };
        mainAudio.addEventListener('canplay', onCanPlay, { once: true });
        // Fallback: if canplay doesn't fire within 500ms, force play anyway
        // to avoid infinite silence on slow networks
        setTimeout(() => {
          mainAudio.removeEventListener('canplay', onCanPlay);
          if (mainAudio.paused && mainAudio.src) {
            void mainAudio.play();
          }
        }, 500);

        // Clear preload
        audioNextRef.current.src = '';
        preloadedNextMidRef.current = null;
      }
      handleSkip(true);
    }
  };

  /**
   * Called from the "点击启用音频播放" button.
   * This runs synchronously within a user gesture (click/tap),
   * which is critical for Safari/iOS to permit audio playback.
   *
   * Key insight: Safari's gesture token is consumed by the first `play()` call.
   * If we unlock with silent MP3 first, the second play() for real audio
   * crosses an await boundary and may be rejected. So we go directly to
   * the real source if available, falling back to silent unlock only if needed.
   */
  const activateAudio = async () => {
    if (!audioRef.current) return;
    const audio = audioRef.current;

    if (audioUrl) {
      // Best path: play the real audio directly within the user gesture.
      // This both unlocks the audio context AND starts playback in one step.
      audio.src = audioUrl;
      try {
        await audio.play();
        audioUnlockedRef.current = true;
        setNeedsAudioActivation(false);
        return;
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[Player] activateAudio direct play failed:', error);
        }
      }
    }

    // Fallback: no audioUrl yet, or direct play failed.
    // Unlock with silent MP3 so future programmatic play() calls work.
    if (!audioUnlockedRef.current) {
      audio.muted = true;
      audio.src = SILENT_MP3;
      try {
        await audio.play();
        audio.pause();
      } catch {}
      audio.muted = false;
      audio.removeAttribute('src');
      audio.load();
      audioUnlockedRef.current = true;
    }
    setNeedsAudioActivation(false);
  };

  useEffect(() => {
    if ('mediaSession' in navigator && room?.currentSong) {
      const song = room.currentSong;
      let singerName = '未知歌手';
      if (Array.isArray(song.singer)) {
        singerName = song.singer.map((s: any) => s.name).join(' / ');
      } else if (typeof song.singer === 'string') {
        singerName = song.singer;
      }

      const albummid = song.albummid || (song.album as any)?.mid || '';
      const artwork = albummid
        ? [{ src: `https://y.qq.com/music/photo_new/T002R300x300M000${albummid}.jpg`, sizes: '300x300', type: 'image/jpeg' }]
        : [];

      navigator.mediaSession.metadata = new MediaMetadata({
        title: song.songname,
        artist: singerName,
        album: song.albumname || (song.album as any)?.name || 'Echo Music',
        artwork,
      });

      navigator.mediaSession.setActionHandler('play', () => {
        if (!room.isPlaying) togglePlay();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (room.isPlaying) togglePlay();
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        handleSkip(false);
      });
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
          handleSeek(details.seekTime);
        }
      });
    }

    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', null);
        navigator.mediaSession.setActionHandler('pause', null);
        navigator.mediaSession.setActionHandler('nexttrack', null);
        navigator.mediaSession.setActionHandler('seekto', null);
      }
    };
  }, [room?.currentSong, room?.isPlaying]);

  return {
    room,
    audioUrl,
    localCurrentTime,
    duration,
    songLoading,
    needsAudioActivation,
    audioRef,
    audioNextRef,
    isSyncLeader,
    handleTimeUpdate,
    handleLoadedMetadata,
    handlePlayPause,
    handleEnded,
    togglePlay,
    handleSeek,
    handleSkip,
    activateAudio,
  };
}
