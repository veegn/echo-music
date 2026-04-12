import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { ChatMessage, RoomState } from './types';

interface AppState {
  socket: Socket | null;
  connectionState: 'connected' | 'connecting' | 'disconnected';
  userName: string;
  room: RoomState | null;
  chat: ChatMessage[];
  toast: { message: string; type: 'success' | 'error' | 'info'; id: number } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;
  setUserName: (name: string) => void;
  setRoomState: (room: RoomState | null) => void;
  joinRoom: (roomId: string, password?: string) => Promise<void>;
  leaveRoom: () => void;
  sendMessage: (text: string) => void;
  addSong: (song: any) => void;
  skipSong: (isAuto?: boolean) => void;
  reorderQueue: (oldIndex: number, newIndex: number) => void;
  removeSong: (index: number) => void;
  setCookie: (cookie: string) => Promise<void>;
  syncPlayer: (currentTime: number, isPlaying: boolean) => void;
  controlPlayback: (currentTime: number, isPlaying: boolean) => void;
  seekPlayer: (currentTime: number) => void;
  playSongs: (songs: any[]) => void;
  clearQueue: () => void;
}

const USER_NAME_KEY = 'echo_music_username';

export const useStore = create<AppState>((set, get) => ({
  socket: null,
  connectionState: 'disconnected',
  userName: localStorage.getItem(USER_NAME_KEY) || '',
  room: null,
  chat: [],
  toast: null,
  showToast: (message, type = 'info') => {
    const id = Date.now();
    set({ toast: { message, type, id } });
    setTimeout(() => {
      if (get().toast?.id === id) {
        set({ toast: null });
      }
    }, 3000);
  },
  clearToast: () => set({ toast: null }),
  setUserName: (name) => {
    localStorage.setItem(USER_NAME_KEY, name);
    set({ userName: name });
  },
  setRoomState: (room) => set({ room }),
  joinRoom: (roomId, password) => {
    return new Promise((resolve, reject) => {
      const socket = io('/', { transports: ['websocket'] });
      let resolved = false;

      socket.on('connect', () => {
        set({ connectionState: 'connected' });
        socket.emit('join_room', { roomId, userName: get().userName, password });
      });

      socket.on('disconnect', () => {
        set({ connectionState: 'disconnected' });
      });

      socket.on('connect_error', () => {
        set({ connectionState: 'connecting' });
      });

      socket.on('room_state', (state: RoomState) => {
        set({ room: state, chat: state.chat || [] });
        if (!resolved) {
          window.history.pushState({}, '', '?room=' + state.id);
          resolved = true;
          resolve();
        }
      });

      socket.on('chat_message', (msg: ChatMessage) => {
        set((state) => {
          if (state.chat.some((item) => item.id === msg.id)) return state;
          return { chat: [...state.chat, msg] };
        });
      });

      socket.on('player_sync', ({
        currentTime,
        isPlaying,
        syncedAt,
        syncLeaderId,
        syncLeaderName,
        syncTerm,
        syncVersion,
      }: {
        currentTime: number;
        isPlaying: boolean;
        syncedAt?: number;
        syncLeaderId?: string;
        syncLeaderName?: string;
        syncTerm?: number;
        syncVersion?: number;
      }) => {
        set((state) => {
          if (!state.room) return state;
          if (syncVersion !== undefined && state.room.syncVersion !== undefined && syncVersion < state.room.syncVersion) {
            return state; // Ignore stale sync events
          }

          let estimatedLatency = 0.150;
          let timeSinceServerEmitted = syncedAt ? (Date.now() - syncedAt) / 1000 : 0;
          let validOffset = Math.max(0, timeSinceServerEmitted);
          let finalTime = isPlaying ? currentTime + validOffset + estimatedLatency : currentTime;

          return {
            room: {
              ...state.room,
              currentTime: finalTime,
              isPlaying,
              syncLeaderId: syncLeaderId ?? state.room.syncLeaderId,
              syncLeaderName: syncLeaderName ?? state.room.syncLeaderName,
              syncTerm: syncTerm ?? state.room.syncTerm,
              syncVersion: syncVersion ?? state.room.syncVersion,
            },
          };
        });
      });

      socket.on('error', (err: string) => {
        if (!resolved) {
          resolved = true;
          socket.disconnect();
          reject(new Error(err));
        }
      });

      set({ socket, connectionState: 'connecting' });
    });
  },
  leaveRoom: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
    }
    set({ socket: null, room: null, chat: [], connectionState: 'disconnected' });
    window.history.pushState({}, '', window.location.pathname);
  },
  sendMessage: (text) => {
    get().socket?.emit('chat_message', text);
  },
  addSong: (song) => {
    get().socket?.emit('add_song', song);
  },
  skipSong: (isAuto) => {
    get().socket?.emit('skip_song', isAuto);
  },
  reorderQueue: (oldIndex, newIndex) => {
    get().socket?.emit('reorder_queue', { oldIndex, newIndex });
  },
  removeSong: (index) => {
    get().socket?.emit('remove_song', index);
  },
  setCookie: (cookie) => {
    return new Promise((resolve, reject) => {
      const socket = get().socket;
      if (!socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      socket.emit('set_cookie', cookie, (response?: { success?: boolean; error?: string }) => {
        if (response?.success) {
          resolve();
          return;
        }

        reject(new Error(response?.error || 'Failed to save cookie'));
      });
    });
  },
  syncPlayer: (currentTime, isPlaying) => {
    const room = get().room;
    get().socket?.emit('sync_player', {
      currentTime,
      isPlaying,
      term: room?.syncTerm ?? 0,
      version: room?.syncVersion ?? 0,
    });
    set((state) => {
      if (state.room) {
        return { room: { ...state.room, currentTime, isPlaying } };
      }
      return state;
    });
  },
  controlPlayback: (currentTime, isPlaying) => {
    const room = get().room;
    get().socket?.emit('control_playback', { currentTime, isPlaying, version: room?.syncVersion ?? 0 });
  },
  seekPlayer: (currentTime) => {
    const room = get().room;
    get().socket?.emit('seek_player', { currentTime, version: room?.syncVersion ?? 0 });
    set((state) => {
      if (state.room) {
        return { room: { ...state.room, currentTime } };
      }
      return state;
    });
  },
  playSongs: (songs) => {
    get().socket?.emit('play_songs', songs);
  },
  clearQueue: () => {
    get().socket?.emit('clear_queue');
  },
}));
