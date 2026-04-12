import path from "path";

// 解析基础存储路径
const BASE_STORAGE_DIR = process.env.ECHO_MUSIC_STORAGE_DIR
    ? path.resolve(process.env.ECHO_MUSIC_STORAGE_DIR)
    : path.join(process.cwd(), "server", "storage");

export const config = {
    // 存储与缓存基建配置
    storage: {
        baseDir: BASE_STORAGE_DIR,
        roomsDir: path.join(BASE_STORAGE_DIR, "rooms"),
        cacheRootDir: path.join(BASE_STORAGE_DIR, "music-cache"),
        cacheAudioDir: path.join(BASE_STORAGE_DIR, "music-cache", "audio"),
        cacheCoverDir: path.join(BASE_STORAGE_DIR, "music-cache", "cover"),
        cacheDbFile: path.join(BASE_STORAGE_DIR, "music-cache", "index.sqlite"),
        // 防抖写入延迟
        roomFlushDebounceMs: 5000,
        cacheFlushDebounceMs: 250,
    },

    // 房间核心参数配置
    room: {
        // 同步控制器霸占租约时长 (毫秒)
        syncLeaseMs: 5000,
        // 新建房间多少毫秒无人操作后被销毁
        idleDestructionMs: 5 * 60 * 1000,
        // 从磁盘恢复的常驻房间销毁延迟
        loadedRoomDestructionMs: 60 * 60 * 1000,
        // 聊天记录最大留存数量
        maxChatHistory: 100,
    },

    // 第三方 API 与服务配置
    api: {
        qqMusicTimeoutMs: 30000,
        maxRedirects: 5,
    }
};
