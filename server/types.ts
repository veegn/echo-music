// ============================
// 服务端类型定义
// ============================

export interface User {
    id: string;     // socket.id
    name: string;
}

export interface Song {
    id: string;
    songmid: string;
    songname: string;
    singer: string;         // 统一为格式化后的字符串
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

export interface Room {
    id: string;
    name: string;
    password: string;
    hostName: string;
    hostCookie: string | null;
    hostQQId: string;
    users: User[];
    queue: Song[];
    currentSong: Song | null;
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

/** 发送给客户端的安全房间状态（不包含密码和 cookie 原文） */
export interface SafeRoomState {
    id: string;
    name: string;
    hostName: string;
    users: User[];
    queue: Song[];
    currentSong: Song | null;
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

/** 房间列表中展示的公开信息 */
export interface PublicRoomInfo {
    id: string;
    name: string;
    hostName: string;
    hasPassword: boolean;
    usersCount: number;
    currentSong: Song | null;
}
