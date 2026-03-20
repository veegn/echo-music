import fs from 'fs';
import path from 'path';
import test from 'node:test';
import assert from 'node:assert/strict';
import QQMusicApi from '../index';
import contextRouter from '../routers/context';

const fixtureDir = path.resolve(__dirname, 'cassettes');
process.env.QQMUSIC_API_HTTP_MODE = 'replay';
process.env.QQMUSIC_API_HTTP_FIXTURE_DIR = fixtureDir;

type Manifest = {
  songmid: string;
  songid: string;
  singerMid: string;
  playlistId: string;
  topId: string;
  tagId: string;
};

function loadManifest(): Manifest {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, 'manifest.json'), 'utf8')) as Manifest;
}

function createMockContext(query: Record<string, any> = {}, body: Record<string, any> = {}) {
  return {
    query,
    params: query,
    request: { body },
    body: undefined as any,
    status: 200,
  };
}

async function invokeHandler(
  handlerName: keyof typeof contextRouter,
  query: Record<string, any> = {},
  body: Record<string, any> = {},
) {
  const ctx = createMockContext(query, body);
  await contextRouter[handlerName](ctx as any, async () => {});
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

test('replay fixtures manifest exists', () => {
  assert.equal(fs.existsSync(path.join(fixtureDir, 'manifest.json')), true);
});

test('replay music and search endpoints from cassettes', async () => {
  const manifest = loadManifest();

  const hot = await QQMusicApi.api('/search/hot');
  assert.equal(hot.data?.code ?? hot.data?.response?.code ?? 0, 0);

  const search = await QQMusicApi.api('/search', { key: '周杰伦', page: 1, limit: 3 });
  assert.ok(firstArray(search.data?.list).length > 0);

  const lyric = await QQMusicApi.api('/lyric', { songmid: manifest.songmid });
  assert.ok(lyric.data);

  const songUrl = await QQMusicApi.api('/song/url', { id: manifest.songmid });
  assert.ok(songUrl.data);

  const newSongs = await QQMusicApi.api('/songs/new', { areaId: 5, limit: 10 });
  assert.ok(newSongs.data);
});

test('replay singer and playlist handlers from cassettes', async () => {
  const manifest = loadManifest();

  const singerList = await invokeHandler('getSingerList');
  assert.equal(singerList.status, 200);

  const singerDesc = await invokeHandler('getSingerDesc', { singermid: manifest.singerMid });
  assert.equal(singerDesc.status, 200);

  const singerAlbum = await invokeHandler('getSingerAlbum', { singermid: manifest.singerMid, page: '0', limit: '5' });
  assert.equal(singerAlbum.status, 200);

  const singerHotsong = await invokeHandler('getSingerHotsong', { singermid: manifest.singerMid, page: '1', limit: '5' });
  assert.equal(singerHotsong.status, 200);

  const singerMv = await invokeHandler('getSingerMv', { singermid: manifest.singerMid, num: '5' });
  assert.equal(singerMv.status, 200);

  const singerStarNum = await invokeHandler('getSingerStarNum', { singermid: manifest.singerMid });
  assert.equal(singerStarNum.status, 200);

  const similarSinger = await invokeHandler('getSimilarSinger', { singermid: manifest.singerMid });
  assert.equal(similarSinger.status, 200);

  const categories = await invokeHandler('getSongListCategories');
  assert.equal(categories.status, 200);

  const playlistTags = await invokeHandler('getPlaylistTags');
  assert.equal(playlistTags.status, 200);

  const playlistsByTag = await invokeHandler('getPlaylistsByTag', { tagId: manifest.tagId, page: '0', num: '5' });
  assert.equal(playlistsByTag.status, 200);

  const songLists = await invokeHandler('getSongLists', { categoryId: manifest.tagId, page: '0', limit: '5' });
  assert.equal(songLists.status, 200);

  const songListDetail = await invokeHandler('getSongListDetail', { id: manifest.playlistId });
  assert.equal(songListDetail.status, 200);
});

test('replay rank, comments, and other handlers from cassettes', async () => {
  const manifest = loadManifest();

  const songInfo = await invokeHandler('getSongInfo', { songmid: manifest.songmid });
  assert.equal(songInfo.status, 200);

  const topLists = await invokeHandler('getTopLists');
  assert.equal(topLists.status, 200);

  const ranks = await invokeHandler('getRanks', { topId: manifest.topId, page: '0', limit: '10' });
  assert.equal(ranks.status, 200);

  const comments = await invokeHandler('getComments', { id: manifest.songid });
  assert.equal(comments.status, 200);

  const radioLists = await invokeHandler('getRadioLists');
  assert.equal(radioLists.status, 200);

  const radioTracks = await invokeHandler('getRadioTracks', { id: '99' });
  assert.equal(radioTracks.status, 200);

  const digitalAlbums = await invokeHandler('getDigitalAlbumLists');
  assert.equal(digitalAlbums.status, 200);

  const mv = await invokeHandler('getMv', { area_id: '15', version_id: '7', limit: '5', page: '1' });
  assert.equal(mv.status, 200);

  const mvByTag = await invokeHandler('getMvByTag');
  assert.equal(mvByTag.status, 200);

  const recommend = await invokeHandler('getRecommend');
  assert.equal(recommend.status, 200);

  const ticketInfo = await invokeHandler('getTicketInfo');
  assert.equal(ticketInfo.status, 200);

  const newDisks = await invokeHandler('getNewDisks', { page: '1', limit: '10' });
  assert.equal(newDisks.status, 200);

  const smartbox = await invokeHandler('getSmartbox', { key: '周' });
  assert.equal(smartbox.status, 200);
});
