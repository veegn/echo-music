import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';

// Tiny silent WAV base64 for Safari audio-context unlock - more robust than MP3
const SILENT_AUDIO = 'data:audio/wav;base64,UklGRigAAABXQVZFRm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAP8A/w==';

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
  // Tracks whether the audio element has been "blessed" by a user gesture.
  // On iOS Safari, once an <audio> element has successfully called play()
  // from within a user gesture, subsequent programmatic play() calls on
  // that same element are permitted — even with different src values.
  const audioUnlockedRef = useRef(false);
  // Tracks whether we should auto-play once audioUrl becomes available.
  // This handles the case where the user clicks "activate" but audioUrl
  // is still empty (server hasn't resolved the play URL yet).
  const pendingPlayRef = useRef(false);

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
   * Try to play the current audio. If the browser rejects the play() call
   * (autoplay policy), show the activation banner.
   */
  const playWithActivationTracking = async () => {
    if (!audioRef.current) return false;

    // Cannot play without a source
    if (!audioRef.current.src || audioRef.current.src === window.location.href) {
      return false;
    }

    try {
      await audioRef.current.play();
      audioUnlockedRef.current = true;
      setNeedsAudioActivation(false);
      pendingPlayRef.current = false;
      return true;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('[Player] audio playback requires user activation or failed to start:', error);
      }
      setNeedsAudioActivation(true);
      return false;
    }
  };

  // Passive unlock: attempt to unlock audio on first user interaction anywhere.
  // This catches gestures like tapping "add song" or navigating the UI, so the
  // audio element is blessed before we actually need to play music.
  useEffect(() => {
    const handleFirstInteraction = () => {
      if (!audioUnlockedRef.current) {
        // Unlock both main and next audio elements
        [audioRef.current, audioNextRef.current].forEach(audio => {
          if (audio) {
            audio.muted = true;
            // Only set SILENT_AUDIO if there is no real source yet
            if (!audio.src || audio.src === window.location.href) {
              audio.src = SILENT_AUDIO;
            }
            audio.play().then(() => {
              audio.pause();
              audio.muted = false;
              // Do NOT call load() or removeAttribute('src') here!
              // It keeps the element in a "blessed" and "ready" state for Safari.
            }).catch(() => {
              audio.muted = false;
            });
          }
        });
        audioUnlockedRef.current = true;
      }
    };
    document.addEventListener('click', handleFirstInteraction, { once: true });
    document.addEventListener('touchend', handleFirstInteraction, { once: true });
    return () => {
      document.removeEventListener('click', handleFirstInteraction);
      document.removeEventListener('touchend', handleFirstInteraction);
    };
  }, []);

  // Resume audio after iOS suspends the process in background.
  useEffect(() => {
    const handleResume = () => {
      if (document.visibilityState !== 'visible') return;
      if (!audioRef.current || !room?.isPlaying) return;
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
      pendingPlayRef.current = false;
    }
  }, [room?.currentSong?.songmid, room?.currentSong?.playUrl]);

  // When audioUrl arrives and we have a pending play request from activateAudio,
  // try to play immediately. This handles the case where the user clicked
  // "activate" before the server had resolved the play URL.
  useEffect(() => {
    if (audioUrl && pendingPlayRef.current && audioRef.current) {
      pendingPlayRef.current = false;
      void playWithActivationTracking();
    }
  }, [audioUrl]);

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

  // Follower sync: align local audio with the room's authoritative state
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

  // Leader autoplay: when a new song starts playing and we are the sync leader,
  // try to start playback automatically.
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
        const onCanPlay = () => {
          mainAudio.removeEventListener('canplay', onCanPlay);
          void mainAudio.play();
        };
        mainAudio.addEventListener('canplay', onCanPlay, { once: true });
        // Fallback: if canplay doesn't fire within 500ms, force play
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
   * Runs within a user gesture (click/tap), which is critical for Safari/iOS.
   *
   * Strategy:
   * - Unlock both audio elements in one go.
   * - If audioUrl is available, play it directly (single play() = unlock + play).
   * - If audioUrl is NOT available yet (server still resolving), unlock with
   *   silent audio and set pendingPlayRef so we auto-play when audioUrl arrives.
   */
  const activateAudio = async () => {
    if (!audioRef.current) return;

    // Unlock both elements
    const elements = [audioRef.current, audioNextRef.current].filter(Boolean) as HTMLAudioElement[];

    for (const audio of elements) {
      audio.muted = true;
      const isMain = audio === audioRef.current;

      if (isMain && audioUrl) {
        audio.src = audioUrl;
        audio.muted = false;
      } else if (!audio.src || audio.src === window.location.href) {
        audio.src = SILENT_AUDIO;
      }

      try {
        await audio.play();
        if (isMain && audioUrl) {
          // Keep playing if it's the real song
        } else {
          audio.pause();
          audio.muted = false;
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('[Player] activateAudio unlock failed:', error);
        }
      }
    }

    audioUnlockedRef.current = true;

    // If audioUrl wasn't ready, mark as pending so the audioUrl effect
    // will auto-play when the URL arrives.
    if (!audioUrl) {
      pendingPlayRef.current = true;
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
