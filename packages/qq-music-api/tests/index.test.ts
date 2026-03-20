import test from 'node:test';
import assert from 'node:assert/strict';
import QQMusicApi, { buildMockContext, normalizeSongUrlPayload, routeToHandler } from '../index';
import { createEmptyMockContext, similarSongsController } from '../routers/context/discoveryControllers';
import { albumInfoController } from '../routers/context/mediaControllers';
import { userAvatarController } from '../routers/context/userControllers';

test('routeToHandler contains expected stable route mappings', () => {
  assert.equal(routeToHandler['/search'], 'getSearchByKey');
  assert.equal(routeToHandler['/song/url'], 'getMusicPlay');
  assert.equal(routeToHandler['/radio'], 'getRadioTracks');
  assert.equal(routeToHandler['/recommend/daily'], 'getDailyRecommend');
  assert.equal(routeToHandler['/private/fm'], 'getPrivateFM');
  assert.equal(routeToHandler['/radio/category'], 'getRadioLists');
  assert.equal(routeToHandler['/recommend/playlist/u'], 'getPersonalRecommend');
  assert.equal(routeToHandler['/search/hot'], 'getHotKey');
  assert.equal(routeToHandler['/songs/new'], 'getNewSongs');
  assert.equal(routeToHandler['/lyric'], 'getLyric');
  assert.equal(routeToHandler['/songlist'], 'getSongListDetail');
  assert.equal(routeToHandler['/user/detail'], 'getUserAvatar');
  assert.equal(routeToHandler['/user/songlist'], 'getUserPlaylists');
});

test('buildMockContext forwards cookie into query and params', () => {
  const ctx = buildMockContext({ id: '123', cookie: 'uin=1; qqmusic_key=abc' });
  assert.equal(ctx.query.id, '123');
  assert.equal(ctx.query.cookie, 'uin=1; qqmusic_key=abc');
  assert.equal(ctx.params.cookie, 'uin=1; qqmusic_key=abc');
  assert.deepEqual(ctx.request.body, { id: '123', cookie: 'uin=1; qqmusic_key=abc' });
});

test('normalizeSongUrlPayload extracts flat song url map', () => {
  const normalized = normalizeSongUrlPayload('/song/url', {
    query: {},
    params: {},
    request: { body: {} },
    status: 200,
    body: {
      data: {
        playUrl: {
          songA: { url: 'https://a.example/songA.mp3' },
          songB: { url: 'https://a.example/songB.mp3' }
        }
      }
    }
  });

  assert.deepEqual(normalized, {
    data: {
      songA: 'https://a.example/songA.mp3',
      songB: 'https://a.example/songB.mp3'
    }
  });
});

test('normalizeSongUrlPayload ignores non song-url routes', () => {
  const normalized = normalizeSongUrlPayload('/search', buildMockContext({ key: 'abc' }));
  assert.equal(normalized, null);
});

test('similarSongsController rejects missing songmid with 400', async () => {
  const ctx = createEmptyMockContext();
  await similarSongsController(ctx as any);

  assert.equal(ctx.status, 400);
  assert.deepEqual(ctx.body, {
    response: {
      code: -1,
      msg: 'missing songmid',
      data: null
    }
  });
});

test('albumInfoController rejects missing albummid with normalized bad request body', async () => {
  const ctx = createEmptyMockContext();
  await albumInfoController(ctx as any);

  assert.equal(ctx.status, 400);
  assert.deepEqual(ctx.body, {
    response: {
      code: -1,
      msg: 'missing albummid',
      data: null
    }
  });
});

test('userAvatarController rejects invalid size with normalized bad request body', async () => {
  const ctx = buildMockContext({ uin: '123', size: '0' });
  await userAvatarController(ctx as any);

  assert.equal(ctx.status, 400);
  assert.deepEqual(ctx.body, {
    response: {
      code: -1,
      msg: 'invalid size',
      data: null
    }
  });
});

test('QQMusicApi.api returns null data for unmapped route', async () => {
  const result = await QQMusicApi.api('/not-found');
  assert.deepEqual(result, { data: null });
});
