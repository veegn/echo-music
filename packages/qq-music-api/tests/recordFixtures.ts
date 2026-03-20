import fs from 'fs';
import path from 'path';
import QQMusicApi from '../index';
import contextRouter from '../routers/context';

type MockContext = {
  query: Record<string, any>;
  params: Record<string, any>;
  request: { body: Record<string, any> };
  body: any;
  status: number;
};

function createMockContext(query: Record<string, any> = {}, body: Record<string, any> = {}): MockContext {
  return {
    query,
    params: query,
    request: { body },
    body: undefined,
    status: 200,
  };
}

async function invokeHandler(
  handlerName: keyof typeof contextRouter,
  query: Record<string, any> = {},
  body: Record<string, any> = {},
) {
  const ctx = createMockContext(query, body);
  const handler = contextRouter[handlerName];
  await handler(ctx as any, async () => {});
  return ctx;
}

function firstArray(...candidates: any[]): any[] {
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) {
      return candidate;
    }
  }
  return [];
}

function pickSongMid(song: any): string {
  return song?.songmid || song?.mid || song?.songInfo?.mid || song?.songInfo?.songMid || '';
}

async function main() {
  const fixtureDir = process.env.QQMUSIC_API_HTTP_FIXTURE_DIR || path.resolve(__dirname, 'cassettes');
  fs.mkdirSync(fixtureDir, { recursive: true });

  const searchResult = await QQMusicApi.api('/search', { key: '周杰伦', page: 1, limit: 3 });
  const songs = firstArray(searchResult.data?.list, searchResult.data?.song?.list, searchResult.data?.data?.song?.list);
  const firstSong = songs[0];
  const songmid = pickSongMid(firstSong);
  const songid = String(firstSong?.id || firstSong?.songid || '');
  const singer = Array.isArray(firstSong?.singer) ? firstSong.singer[0] : firstSong?.singer?.[0];
  const singerMid = singer?.mid || singer?.singermid || '';

  const playlistTagsCtx = await invokeHandler('getPlaylistTags');
  const tagGroups = firstArray(
    playlistTagsCtx.body?.response?.data?.categories,
    playlistTagsCtx.body?.response?.data?.v_group,
    playlistTagsCtx.body?.response?.v_group,
  );
  const firstTag = tagGroups.flatMap((group: any) => firstArray(group?.items, group?.v_item)).find(Boolean);
  const tagId = String(firstTag?.categoryId || firstTag?.id || 1);

  const songListsCtx = await invokeHandler('getSongLists', { categoryId: tagId, page: '0', limit: '5' });
  const songLists = firstArray(
    songListsCtx.body?.response?.data?.list,
    songListsCtx.body?.response?.list,
  );
  const firstPlaylist = songLists[0];
  const playlistId = String(firstPlaylist?.dissid || firstPlaylist?.tid || firstPlaylist?.id || '');

  const topListsCtx = await invokeHandler('getTopLists');
  const topGroups = firstArray(
    topListsCtx.body?.response?.data?.group,
    topListsCtx.body?.response?.group,
  );
  const firstTop = topGroups.flatMap((group: any) => firstArray(group?.toplist, group?.list)).find(Boolean);
  const topId = String(firstTop?.topId || firstTop?.id || 4);

  const manifest = {
    songmid,
    songid,
    singerMid,
    playlistId,
    topId,
    tagId,
  };

  if (!songmid || !singerMid || !playlistId) {
    throw new Error(`Failed to derive stable fixture ids: ${JSON.stringify(manifest)}`);
  }

  await QQMusicApi.api('/search/hot');
  await QQMusicApi.api('/search', { key: '周杰伦', page: 1, limit: 3 });
  await QQMusicApi.api('/lyric', { songmid });
  await QQMusicApi.api('/song/url', { id: songmid });
  await QQMusicApi.api('/songs/new', { areaId: 5, limit: 10 });
  await QQMusicApi.api('/radio/category');

  await invokeHandler('getSongInfo', { songmid });
  await invokeHandler('getSingerList');
  await invokeHandler('getSingerDesc', { singermid: singerMid });
  await invokeHandler('getSingerAlbum', { singermid: singerMid, page: '0', limit: '5' });
  await invokeHandler('getSingerHotsong', { singermid: singerMid, page: '1', limit: '5' });
  await invokeHandler('getSingerMv', { singermid: singerMid, num: '5' });
  await invokeHandler('getSingerStarNum', { singermid: singerMid });
  await invokeHandler('getSimilarSinger', { singermid: singerMid });
  await invokeHandler('getSongListCategories');
  await invokeHandler('getSongLists', { categoryId: tagId, page: '0', limit: '5' });
  await invokeHandler('getSongListDetail', { id: playlistId });
  await invokeHandler('getPlaylistTags');
  await invokeHandler('getPlaylistsByTag', { tagId, page: '0', num: '5' });
  await invokeHandler('getTopLists');
  await invokeHandler('getRanks', { topId, page: '0', limit: '10' });
  await invokeHandler('getComments', { id: songid });
  await invokeHandler('getDigitalAlbumLists');
  await invokeHandler('getMv', { area_id: '15', version_id: '7', limit: '5', page: '1' });
  await invokeHandler('getMvByTag');
  await invokeHandler('getRecommend');
  await invokeHandler('getRadioLists');
  await invokeHandler('getRadioTracks', { id: '99' });
  await invokeHandler('getTicketInfo');
  await invokeHandler('getNewDisks', { page: '1', limit: '10' });
  await invokeHandler('getSmartbox', { key: '周' });

  fs.writeFileSync(path.join(fixtureDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(`Recorded fixtures to ${fixtureDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
