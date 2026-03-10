// ============================
// 前端共享类型定义
// ============================

export interface User {
    id: string;
    name: string;
}

export interface Song {
    id: string;
    songmid: string;
    songname: string;
    singer: string | { name: string }[];
    albumname: string;
    albummid: string;
    album?: {
        mid?: string;
        pmid?: string;
        id?: number;
    };
    requestedBy: string;
}

export interface ChatMessage {
    id: number;
    type: 'system' | 'user';
    userName?: string;
    text: string;
}

export interface RoomState {
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
    chat: ChatMessage[];
}

export interface LyricLine {
    time: number;
    text: string;
}
