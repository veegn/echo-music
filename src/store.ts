import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import { RoomState, ChatMessage, User, Song } from './types';

interface AppState {
  socket: Socket | null;
  connectionState: 'connected' | 'connecting' | 'disconnected';
  userName: string;
  room: RoomState | null;
  chat: ChatMessage[];
  toast: { message: string, type: 'success' | 'error' | 'info', id: number } | null;

  // Actions
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;
  setUserName: (name: string) => void;
  joinRoom: (roomId: string, password?: string) => Promise<void>;
  leaveRoom: () => void;
  sendMessage: (text: string) => void;
  addSong: (song: any) => void;
  skipSong: (isAuto?: boolean) => void;
  reorderQueue: (oldIndex: number, newIndex: number) => void;
  removeSong: (index: number) => void;
  setCookie: (cookie: string) => void;
  syncPlayer: (currentTime: number, isPlaying: boolean) => void;
  playSongs: (songs: any[]) => void;
  clearQueue: () => void;
}

const STORAGE_KEY = 'casebuy_music_username';

export const useStore = create<AppState>((set, get) => ({
  socket: null,
  connectionState: 'disconnected',
  userName: localStorage.getItem(STORAGE_KEY) || '',
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
    }, 3000); // 3 seconds expiry
  },
  clearToast: () => set({ toast: null }),
  setUserName: (name) => {
    localStorage.setItem(STORAGE_KEY, name);
    set({ userName: name });
  },
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
          if (state.chat.some(c => c.id === msg.id)) return state;
          return { chat: [...state.chat, msg] };
        });
      });

      socket.on('player_sync', ({ currentTime, isPlaying }) => {
        set((state) => {
          if (state.room) {
            return { room: { ...state.room, currentTime, isPlaying } };
          }
          return state;
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
    get().socket?.emit('set_cookie', cookie);
  },
  syncPlayer: (currentTime, isPlaying) => {
    get().socket?.emit('sync_player', { currentTime, isPlaying });
    // Optimistically update the UI locally for the host avoiding round-trip delay
    set((state) => {
      if (state.room) {
        return { room: { ...state.room, currentTime, isPlaying } };
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
