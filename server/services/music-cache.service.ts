import fs from "fs";
import path from "path";
import { pipeline } from "stream";
import { promisify } from "util";
import axios from "axios";
import initSqlJs, { Database } from "sql.js";
import { Song } from "../types.js";
import { logError, logInfo, logWarn } from "../logger.js";
import * as qqMusicService from "./qqmusic.service.js";

const TAG = "MusicCacheService";
const STORAGE_DIR = process.env.ECHO_MUSIC_STORAGE_DIR
    ? path.resolve(process.env.ECHO_MUSIC_STORAGE_DIR)
    : path.join(process.cwd(), "server", "storage");
const CACHE_ROOT = path.join(STORAGE_DIR, "music-cache");
const AUDIO_DIR = path.join(CACHE_ROOT, "audio");
const COVER_DIR = path.join(CACHE_ROOT, "cover");
const LEGACY_INDEX_FILE = path.join(CACHE_ROOT, "index.json");
const DB_FILE = path.join(CACHE_ROOT, "index.sqlite");
const SQL_WASM_DIR = path.join(process.cwd(), "node_modules", "sql.js", "dist");

export interface CachedTrackRecord {
    songmid: string;
    songname: string;
    singer: string;
    albumname: string;
    albummid: string;
    intro: string;
    audioSourceUrl: string;
    audioLocalPath: string;
    audioSize: number;
    coverSourceUrl: string;
    coverLocalPath: string;
    requestedBy: string;
    cachedAt: string;
    lastPlayedAt: string;
}

export interface CachedTrackStats {
    totalTracks: number;
    totalAudioSize: number;
    totalCoverSize: number;
    totalSize: number;
    latestCachedAt: string;
}

export interface CachedTrackQueryResult {
    list: ReturnType<typeof toPublicRecord>[];
    total: number;
    page: number;
    pageSize: number;
}

export interface CacheJobInfo {
    id: string;
    songmid: string;
    type: "cache" | "recache";
    status: "pending" | "running" | "succeeded" | "failed";
    error?: string;
    updatedAt: string;
}

const streamPipeline = promisify(pipeline);

let db: Database;
let flushTimer: NodeJS.Timeout | null = null;
const cacheJobs = new Map<string, CacheJobInfo>();
const jobKeys = new Map<string, string>();
const jobQueue: string[] = [];
let jobRunning = false;

function ensureCacheDirs(): void {
    for (const dir of [CACHE_ROOT, AUDIO_DIR, COVER_DIR]) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}

function scheduleFlush(): void {
    if (flushTimer) {
        clearTimeout(flushTimer);
    }

    flushTimer = setTimeout(() => {
        flushTimer = null;
        flushDb();
    }, 250);
}

function flushDb(): void {
    ensureCacheDirs();
    const data = db.export();
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, Buffer.from(data));
    fs.renameSync(tmpFile, DB_FILE);
}

function fileExists(filePath: string): boolean {
    return !!filePath && fs.existsSync(filePath);
}

function sanitizeFileSegment(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function getAudioExtension(sourceUrl: string): string {
    try {
        const pathname = new URL(sourceUrl).pathname;
        const ext = path.extname(pathname).replace(".", "").toLowerCase();
        return ext || "mp3";
    } catch {
        return "mp3";
    }
}

function getCoverExtension(sourceUrl: string): string {
    try {
        const pathname = new URL(sourceUrl).pathname;
        const ext = path.extname(pathname).replace(".", "").toLowerCase();
        return ext || "jpg";
    } catch {
        return "jpg";
    }
}

function getAudioFilePath(songmid: string, sourceUrl: string): string {
    return path.join(AUDIO_DIR, `${sanitizeFileSegment(songmid)}.${getAudioExtension(sourceUrl)}`);
}

function getCoverFilePath(songmid: string, sourceUrl: string): string {
    return path.join(COVER_DIR, `${sanitizeFileSegment(songmid)}.${getCoverExtension(sourceUrl)}`);
}

function safeUnlink(filePath: string): void {
    if (!fileExists(filePath)) {
        return;
    }

    try {
        fs.unlinkSync(filePath);
    } catch (error) {
        logWarn(TAG, "Failed to remove cached file", {
            filePath,
            message: (error as Error)?.message,
        });
    }
}

function stripLyricText(raw: string): string {
    return raw
        .split(/\r?\n/)
        .map((line) => line.replace(/\[[^\]]+\]/g, "").trim())
        .filter(Boolean)
        .slice(0, 3)
        .join(" ");
}

function formatSongIntro(song: Song, lyricSnippet = ""): string {
    const base = [song.songname, song.singer, song.albumname].filter(Boolean).join(" / ");
    return lyricSnippet ? `${base} | ${lyricSnippet}` : base;
}

function normalizeTrackTextFields(song: Song, existing?: CachedTrackRecord | null) {
    const runtimeSong = song as Song & {
        album?: {
            mid?: string;
            name?: string;
            title?: string;
        };
    };

    const songname = song.songname || existing?.songname || "Unknown Song";
    const singer = song.singer || existing?.singer || "Unknown Artist";
    const albumname =
        song.albumname ||
        runtimeSong.album?.title ||
        runtimeSong.album?.name ||
        existing?.albumname ||
        "Unknown Album";
    const requestedBy = song.requestedBy || existing?.requestedBy || "LocalCache";

    return {
        songname,
        singer,
        albumname,
        requestedBy,
    };
}

function getCoverSourceUrl(song: Pick<Song, "albummid" | "album">): string {
    const albumMid = song.albummid || song.album?.mid || "";
    return albumMid
        ? `https://y.qq.com/music/photo_new/T002R300x300M000${albumMid}.jpg`
        : "";
}

function toPublicRecord(record: CachedTrackRecord) {
    return {
        ...record,
        audioUrl: `/api/local-music/audio/${encodeURIComponent(record.songmid)}`,
        coverUrl: record.coverLocalPath
            ? `/api/local-music/cover/${encodeURIComponent(record.songmid)}`
            : record.coverSourceUrl,
    };
}

function nowIso(): string {
    return new Date().toISOString();
}

function updateJob(jobId: string, patch: Partial<CacheJobInfo>): CacheJobInfo | null {
    const current = cacheJobs.get(jobId);
    if (!current) return null;
    const next = {
        ...current,
        ...patch,
        updatedAt: nowIso(),
    };
    cacheJobs.set(jobId, next);
    return next;
}

function rowToRecord(row: any[]): CachedTrackRecord {
    return {
        songmid: String(row[0] || ""),
        songname: String(row[1] || ""),
        singer: String(row[2] || ""),
        albumname: String(row[3] || ""),
        albummid: String(row[4] || ""),
        intro: String(row[5] || ""),
        audioSourceUrl: String(row[6] || ""),
        audioLocalPath: String(row[7] || ""),
        audioSize: Number(row[8] || 0),
        coverSourceUrl: String(row[9] || ""),
        coverLocalPath: String(row[10] || ""),
        requestedBy: String(row[11] || ""),
        cachedAt: String(row[12] || ""),
        lastPlayedAt: String(row[13] || ""),
    };
}

function queryRows(sql: string, params: unknown[] = []): CachedTrackRecord[] {
    const result = db.exec(sql, params);
    if (!result[0]) {
        return [];
    }
    return result[0].values.map(rowToRecord);
}

function getOne(sql: string, params: unknown[] = []): CachedTrackRecord | null {
    return queryRows(sql, params)[0] || null;
}

async function downloadFile(sourceUrl: string, targetPath: string): Promise<number> {
    const response = await axios.get(sourceUrl, {
        responseType: "stream",
        timeout: 30000,
        maxRedirects: 5,
    });

    const tmpPath = `${targetPath}.tmp`;
    try {
        await streamPipeline(response.data, fs.createWriteStream(tmpPath));
        fs.renameSync(tmpPath, targetPath);
        return fs.statSync(targetPath).size;
    } catch (error) {
        if (fs.existsSync(tmpPath)) {
            fs.unlinkSync(tmpPath);
        }
        throw error;
    }
}

async function resolveLyricSnippet(songmid: string): Promise<string> {
    try {
        const lyricData = await qqMusicService.getLyric(songmid);
        const lyric =
            lyricData?.lyric ||
            lyricData?.data?.lyric ||
            lyricData?.response?.lyric ||
            "";
        return stripLyricText(String(lyric || ""));
    } catch (error) {
        logWarn(TAG, "Failed to fetch lyric snippet", { songmid, message: (error as Error)?.message });
        return "";
    }
}

async function performCacheSong(song: Song, audioUrl: string): Promise<void> {
    if (!song?.songmid || !audioUrl) {
        return;
    }

    ensureCacheDirs();
    const existing = getOne("SELECT * FROM cached_tracks WHERE songmid = ?", [song.songmid]);
    const now = nowIso();
    const normalized = normalizeTrackTextFields(song, existing);
    const audioPath = getAudioFilePath(song.songmid, audioUrl);
    const coverSourceUrl = getCoverSourceUrl(song);
    const coverPath = coverSourceUrl ? getCoverFilePath(song.songmid, coverSourceUrl) : "";
    const lyricSnippet = await resolveLyricSnippet(song.songmid);

    let audioSize = 0;
    if (!fileExists(audioPath)) {
        audioSize = await downloadFile(audioUrl, audioPath);
        logInfo(TAG, "Cached audio file", { songmid: song.songmid, audioPath, audioSize });
    } else {
        audioSize = fs.statSync(audioPath).size;
    }

    if (coverSourceUrl && !fileExists(coverPath)) {
        try {
            await downloadFile(coverSourceUrl, coverPath);
            logInfo(TAG, "Cached cover file", { songmid: song.songmid, coverPath });
        } catch (error) {
            logWarn(TAG, "Failed to cache cover file", {
                songmid: song.songmid,
                coverSourceUrl,
                message: (error as Error)?.message,
            });
        }
    }

    const recordPayload: CachedTrackRecord = {
        songmid: song.songmid,
        songname: normalized.songname,
        singer: normalized.singer,
        albumname: normalized.albumname,
        albummid: song.albummid || song.album?.mid || "",
        intro: formatSongIntro({
            ...song,
            songname: normalized.songname,
            singer: normalized.singer,
            albumname: normalized.albumname,
        }, lyricSnippet),
        audioSourceUrl: audioUrl,
        audioLocalPath: audioPath,
        audioSize,
        coverSourceUrl,
        coverLocalPath: fileExists(coverPath) ? coverPath : "",
        requestedBy: normalized.requestedBy,
        cachedAt: existing?.cachedAt || now,
        lastPlayedAt: now,
    };

    const undefinedFields = Object.entries(recordPayload)
        .filter(([, value]) => value === undefined)
        .map(([key]) => key);

    if (undefinedFields.length > 0) {
        logError(TAG, "Cache record contains undefined fields before sqlite upsert", undefined, {
            songmid: song.songmid,
            undefinedFields,
            songSnapshot: {
                id: song.id,
                songmid: song.songmid,
                songname: song.songname,
                singer: song.singer,
                albumname: song.albumname,
                albummid: song.albummid,
                requestedBy: song.requestedBy,
            },
            recordPayload,
        });
    }

    if (
        normalized.songname !== song.songname ||
        normalized.singer !== song.singer ||
        normalized.albumname !== song.albumname ||
        normalized.requestedBy !== song.requestedBy
    ) {
        logWarn(TAG, "Normalized cache track fields before sqlite upsert", {
            songmid: song.songmid,
            original: {
                songname: song.songname,
                singer: song.singer,
                albumname: song.albumname,
                requestedBy: song.requestedBy,
            },
            normalized,
        });
    }

    upsertRecord(recordPayload);
}

function enqueueJob(
    type: CacheJobInfo["type"],
    songmid: string,
    worker: () => Promise<void>,
): CacheJobInfo {
    const dedupeKey = `${type}:${songmid}`;
    const existingJobId = jobKeys.get(dedupeKey);
    if (existingJobId) {
        const existing = cacheJobs.get(existingJobId);
        if (existing && (existing.status === "pending" || existing.status === "running")) {
            return existing;
        }
    }

    const id = `${type}-${songmid}-${Date.now()}`;
    const job: CacheJobInfo = {
        id,
        songmid,
        type,
        status: "pending",
        updatedAt: nowIso(),
    };

    cacheJobs.set(id, job);
    jobKeys.set(dedupeKey, id);
    workerMap.set(id, worker);
    jobQueue.push(id);

    void runNextJob();
    return job;
}

const workerMap = new Map<string, () => Promise<void>>();

async function runNextJob(): Promise<void> {
    if (jobRunning) {
        return;
    }

    const jobId = jobQueue.shift();
    if (!jobId) {
        return;
    }

    const worker = workerMap.get(jobId);
    const job = cacheJobs.get(jobId);
    if (!worker || !job) {
        workerMap.delete(jobId);
        return void runNextJob();
    }

    jobRunning = true;
    updateJob(jobId, { status: "running", error: undefined });

    try {
        await worker();
        updateJob(jobId, { status: "succeeded" });
    } catch (error) {
        logError(TAG, "Cache job failed", error, { jobId, songmid: job.songmid, type: job.type });
        updateJob(jobId, {
            status: "failed",
            error: (error as Error)?.message || "Cache job failed",
        });
    } finally {
        jobRunning = false;
        workerMap.delete(jobId);
        void runNextJob();
    }
}

function upsertRecord(record: CachedTrackRecord): void {
    db.run(
        `INSERT INTO cached_tracks (
            songmid, songname, singer, albumname, albummid, intro,
            audio_source_url, audio_local_path, audio_size,
            cover_source_url, cover_local_path, requested_by,
            cached_at, last_played_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(songmid) DO UPDATE SET
            songname=excluded.songname,
            singer=excluded.singer,
            albumname=excluded.albumname,
            albummid=excluded.albummid,
            intro=excluded.intro,
            audio_source_url=excluded.audio_source_url,
            audio_local_path=excluded.audio_local_path,
            audio_size=excluded.audio_size,
            cover_source_url=excluded.cover_source_url,
            cover_local_path=excluded.cover_local_path,
            requested_by=excluded.requested_by,
            cached_at=excluded.cached_at,
            last_played_at=excluded.last_played_at`,
        [
            record.songmid,
            record.songname,
            record.singer,
            record.albumname,
            record.albummid,
            record.intro,
            record.audioSourceUrl,
            record.audioLocalPath,
            record.audioSize,
            record.coverSourceUrl,
            record.coverLocalPath,
            record.requestedBy,
            record.cachedAt,
            record.lastPlayedAt,
        ],
    );
    scheduleFlush();
}

function createSchema(): void {
    db.run(`
        CREATE TABLE IF NOT EXISTS cached_tracks (
            songmid TEXT PRIMARY KEY,
            songname TEXT NOT NULL,
            singer TEXT NOT NULL,
            albumname TEXT NOT NULL,
            albummid TEXT NOT NULL,
            intro TEXT NOT NULL,
            audio_source_url TEXT NOT NULL,
            audio_local_path TEXT NOT NULL,
            audio_size INTEGER NOT NULL DEFAULT 0,
            cover_source_url TEXT NOT NULL,
            cover_local_path TEXT NOT NULL,
            requested_by TEXT NOT NULL,
            cached_at TEXT NOT NULL,
            last_played_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_cached_tracks_last_played_at ON cached_tracks(last_played_at DESC);
        CREATE INDEX IF NOT EXISTS idx_cached_tracks_songname ON cached_tracks(songname);
        CREATE INDEX IF NOT EXISTS idx_cached_tracks_singer ON cached_tracks(singer);
        CREATE INDEX IF NOT EXISTS idx_cached_tracks_albumname ON cached_tracks(albumname);
    `);
}

function migrateLegacyJsonIndex(): void {
    if (!fs.existsSync(LEGACY_INDEX_FILE)) {
        return;
    }

    try {
        const raw = JSON.parse(fs.readFileSync(LEGACY_INDEX_FILE, "utf-8"));
        for (const record of Object.values(raw) as CachedTrackRecord[]) {
            if (!record?.songmid) continue;
            upsertRecord(record);
        }
        fs.renameSync(LEGACY_INDEX_FILE, `${LEGACY_INDEX_FILE}.migrated`);
        logInfo(TAG, "Migrated legacy music cache index to sqlite", {
            filePath: LEGACY_INDEX_FILE,
            count: Object.keys(raw).length,
        });
    } catch (error) {
        logError(TAG, "Failed to migrate legacy music cache index", error);
    }
}

const SQL = await initSqlJs({
    locateFile: (file) => path.join(SQL_WASM_DIR, file),
});

ensureCacheDirs();
db = fs.existsSync(DB_FILE)
    ? new SQL.Database(fs.readFileSync(DB_FILE))
    : new SQL.Database();
createSchema();
migrateLegacyJsonIndex();
flushDb();

process.on("beforeExit", () => {
    try {
        flushDb();
    } catch (error) {
        logError(TAG, "Failed to flush sqlite cache before exit", error);
    }
});

export async function cachePlayedSong(song: Song, audioUrl: string): Promise<void> {
    if (!song?.songmid || !audioUrl) {
        return;
    }

    enqueueJob("cache", song.songmid, async () => {
        await performCacheSong(song, audioUrl);
    });
}

export function enqueueRecacheTrack(songmid: string): CacheJobInfo | null {
    const record = getOne("SELECT * FROM cached_tracks WHERE songmid = ?", [songmid]);
    if (!record) {
        return null;
    }

    return enqueueJob("recache", songmid, async () => {
        safeUnlink(record.audioLocalPath);
        safeUnlink(record.coverLocalPath);

        const song: Song = {
            id: songmid,
            songmid: record.songmid,
            songname: record.songname,
            singer: record.singer,
            albumname: record.albumname,
            albummid: record.albummid,
            album: { mid: record.albummid },
            requestedBy: record.requestedBy || "LocalCache",
        };

        await performCacheSong(song, record.audioSourceUrl);
    });
}

export function getCacheJob(jobId: string): CacheJobInfo | null {
    return cacheJobs.get(jobId) || null;
}

export function removeCachedTrack(songmid: string): boolean {
    const record = getOne("SELECT * FROM cached_tracks WHERE songmid = ?", [songmid]);
    if (!record) {
        return false;
    }

    safeUnlink(record.audioLocalPath);
    safeUnlink(record.coverLocalPath);
    db.run("DELETE FROM cached_tracks WHERE songmid = ?", [songmid]);
    scheduleFlush();
    return true;
}

export function getCachedTrackStats(): CachedTrackStats {
    const result = db.exec(`
        SELECT
            COUNT(*) AS total_tracks,
            COALESCE(SUM(audio_size), 0) AS total_audio_size,
            COALESCE(MAX(cached_at), '') AS latest_cached_at
        FROM cached_tracks
    `);

    const row = result[0]?.values?.[0] || [0, 0, ""];
    const totalTracks = Number(row[0] || 0);
    const totalAudioSize = Number(row[1] || 0);
    const latestCachedAt = String(row[2] || "");

    const coverRows = queryRows("SELECT * FROM cached_tracks");
    const totalCoverSize = coverRows.reduce((sum, record) => {
        if (!fileExists(record.coverLocalPath)) return sum;
        try {
            return sum + fs.statSync(record.coverLocalPath).size;
        } catch {
            return sum;
        }
    }, 0);

    return {
        totalTracks,
        totalAudioSize,
        totalCoverSize,
        totalSize: totalAudioSize + totalCoverSize,
        latestCachedAt,
    };
}

export function searchCachedTracks(query = "") {
    return searchCachedTracksPage(query, 1, 100);
}

export function searchCachedTracksPage(query = "", page = 1, pageSize = 20): CachedTrackQueryResult {
    const q = query.trim().toLowerCase();
    const normalizedPage = Math.max(1, Number(page) || 1);
    const normalizedPageSize = Math.min(100, Math.max(1, Number(pageSize) || 20));
    const offset = (normalizedPage - 1) * normalizedPageSize;
    const filters = q
        ? [`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`]
        : [];
    const whereClause = q
        ? `WHERE lower(songname) LIKE ?
                OR lower(singer) LIKE ?
                OR lower(albumname) LIKE ?
                OR lower(intro) LIKE ?`
        : "";

    const totalResult = db.exec(
        `SELECT COUNT(*) FROM cached_tracks ${whereClause}`,
        filters,
    );
    const total = Number(totalResult[0]?.values?.[0]?.[0] || 0);

    const records = queryRows(
        `SELECT * FROM cached_tracks
         ${whereClause}
         ORDER BY last_played_at DESC
         LIMIT ? OFFSET ?`,
        [...filters, normalizedPageSize, offset],
    );

    const list = records
        .filter((record) => fileExists(record.audioLocalPath))
        .map(toPublicRecord);

    return {
        list,
        total,
        page: normalizedPage,
        pageSize: normalizedPageSize,
    };
}

export function getCachedTrack(songmid: string) {
    const record = getOne("SELECT * FROM cached_tracks WHERE songmid = ?", [songmid]);
    if (!record || !fileExists(record.audioLocalPath)) {
        return null;
    }
    return toPublicRecord(record);
}

export function getCachedAudioFile(songmid: string): string | null {
    const record = getOne("SELECT * FROM cached_tracks WHERE songmid = ?", [songmid]);
    if (!record || !fileExists(record.audioLocalPath)) {
        return null;
    }
    return record.audioLocalPath;
}

export function getCachedCoverFile(songmid: string): string | null {
    const record = getOne("SELECT * FROM cached_tracks WHERE songmid = ?", [songmid]);
    if (!record || !record.coverLocalPath || !fileExists(record.coverLocalPath)) {
        return null;
    }
    return record.coverLocalPath;
}
