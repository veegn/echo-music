import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';

interface User {
  id: string;
  name: string;
}

interface Song {
  id: string;
  songmid: string;
  songname: string;
  singer: string | { name: string }[];
  albumname: string;
  albummid: string;
  requestedBy: string;
}

interface ChatMessage {
  id: number;
  type: 'system' | 'user';
  userName?: string;
  text: string;
}

interface RoomState {
  id: string;
  name: string;
  hostName: string;
  users: User[];
  queue: Song[];
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  hasCookie: boolean;
  hostQQId: string;
}

interface AppState {
  socket: Socket | null;
  connectionState: 'connecting' | 'connected' | 'disconnected';
  userName: string;
  room: RoomState | null;
  chat: ChatMessage[];
  toast: { message: string; type: 'success' | 'error' | 'info'; id: number } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  clearToast: () => void;
  setUserName: (name: string) => void;
  joinRoom: (roomId: string, password?: string) => Promise<void>;
  leaveRoom: () => void;
  sendMessage: (text: string) => void;
  addSong: (song: any) => void;
  skipSong: () => void;
  reorderQueue: (oldIndex: number, newIndex: number) => void;
  removeSong: (index: number) => void;
  setCookie: (cookie: string) => void;
  syncPlayer: (currentTime: number, isPlaying: boolean) => void;
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
    set({ toast: { message, type, id: Date.now() } });
    setTimeout(() => {
      set((state) => (state.toast?.id === get().toast?.id ? { toast: null } : state));
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
        set({ room: state });
        if (!resolved) {
          window.history.pushState({}, '', '?room=' + state.id);
          resolved = true;
          resolve();
        }
      });

      socket.on('chat_message', (msg: ChatMessage) => {
        set((state) => ({ chat: [...state.chat, msg] }));
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
  skipSong: () => {
    get().socket?.emit('skip_song');
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
}));
