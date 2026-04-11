export interface User {
    id: string;
    name: string;
}

export interface SongMeta {
    id: string;
    songmid: string;
    songname: string;
    singer: string;
    albumname: string;
    albummid: string;
    album?: {
        mid?: string;
        pmid?: string;
        id?: number;
    };
    requestedBy: string;
}

export interface RoomPlaybackSong extends SongMeta {
    playUrl?: string;
    playQuality?: string | number;
}

export type Song = SongMeta;

export interface ChatMessage {
    id: number;
    type: "system" | "user";
    userName?: string;
    text: string;
}

export interface Room {
    id: string;
    name: string;
    password: string;
    hostName: string;
    hostCookie: string | null;
    hostQQId: string;
    users: User[];
    queue: SongMeta[];
    currentSong: RoomPlaybackSong | null;
    isPlaying: boolean;
    currentTime: number;
    syncLeaderId: string;
    syncLeaderName: string;
    syncTerm: number;
    syncVersion: number;
    syncLeaseUntil: number;
    chat: ChatMessage[];
    lastSkipTime?: number;
}

export interface SafeRoomState {
    id: string;
    name: string;
    hostName: string;
    users: User[];
    queue: SongMeta[];
    currentSong: RoomPlaybackSong | null;
    isPlaying: boolean;
    currentTime: number;
    syncLeaderId: string;
    syncLeaderName: string;
    syncTerm: number;
    syncVersion: number;
    syncLeaseUntil: number;
    hasCookie: boolean;
    hostQQId: string;
    chat: ChatMessage[];
}

export interface PublicRoomInfo {
    id: string;
    name: string;
    hostName: string;
    hasPassword: boolean;
    usersCount: number;
    currentSong: RoomPlaybackSong | null;
}
