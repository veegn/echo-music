/**
 * Utility functions for music data processing and formatting
 */

export function formatSinger(singer: unknown): string {
  if (Array.isArray(singer)) {
    return singer.map((s: any) => s.name || s).join(', ');
  }
  if (typeof singer === 'string') return singer;
  return '未知歌手';
}

export function firstArray<T = any>(...candidates: any[]): T[] {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return [];
}

export function normalizeTrack(entry: any) {
  const singer =
    entry?.singer ||
    entry?.ar ||
    entry?.artists ||
    entry?.artist ||
    entry?.singer_name ||
    entry?.artist_name ||
    '未知歌手';

  return {
    ...entry,
    id: entry?.id || entry?.songid || entry?.songmid || entry?.mid || '',
    songmid: entry?.songmid || entry?.mid || entry?.strMediaMid || '',
    songname:
      entry?.songname ||
      entry?.name ||
      entry?.title ||
      entry?.songTitle ||
      entry?.songInfo?.name ||
      entry?.songInfo?.title ||
      '',
    singer,
    albummid:
      entry?.albummid ||
      entry?.album?.mid ||
      entry?.albumMid ||
      entry?.songInfo?.album?.mid ||
      '',
  };
}

export function normalizePlaylistEntry(entry: any) {
  const subtitle = String(entry?.subtitle || '');
  const subtitleMatch = subtitle.match(/\d+/);
  return {
    ...entry,
    playlistId: String(entry?.dissid || entry?.tid || entry?.dirid || ''),
    playlistName: entry?.title || entry?.diss_name || entry?.dissname || '未命名歌单',
    playlistCover: entry?.picurl || entry?.diss_cover || entry?.imgurl || '',
    playlistSongCount: Number(entry?.song_cnt || entry?.songnum || subtitleMatch?.[0] || 0),
  };
}

export function extractPlaylistEntries(payload: any): any[] {
  return firstArray(
    payload?.list,
    payload?.data?.list,
    payload?.data?.response?.data?.playlists,
    payload?.data?.data?.playlists,
    payload?.response?.data?.playlists,
    payload,
  );
}

export function extractRadioStations(payload: any): any[] {
  return firstArray(
    payload?.stations,
    payload?.data?.stations,
    payload?.data?.data?.data?.groupList?.flatMap((group: any) => group?.radioList || []),
    payload?.data?.data?.groupList?.flatMap((group: any) => group?.radioList || []),
    payload?.data?.groupList?.flatMap((group: any) => group?.radioList || []),
  );
}

export function extractRadioTracks(payload: any): any[] {
  return firstArray(
    payload?.tracks,
    payload?.data?.tracks,
    payload?.data?.songlist,
    payload?.songlist,
    payload?.data?.new_song?.data?.songlist,
    payload?.data?.data?.tracks,
    payload?.data?.data?.songlist,
    payload?.data,
  );
}

export function extractPlaylistSongs(payload: any): any[] {
  return firstArray(
    payload?.cdlist?.[0]?.songlist,
    payload?.data?.cdlist?.[0]?.songlist,
    payload?.data?.data?.cdlist?.[0]?.songlist,
    payload?.songlist,
    payload?.data?.songlist,
    payload?.data?.data?.songlist,
    payload?.tracks,
    payload?.data?.tracks,
    payload?.data?.data?.tracks,
  );
}

export function formatSize(size: number) {
  if (!size) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatTime(value: string) {
  return value ? new Date(value).toLocaleString("zh-CN", { hour12: false }) : "-";
}

export function formatDuration(seconds: number) {
  if (!seconds || Number.isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
