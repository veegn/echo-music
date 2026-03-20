import test from 'node:test';
import assert from 'node:assert/strict';
import QQMusicApi from '../index';

test('QQMusicApi.api returns resolved avatar payload for user detail route', async () => {
  const result = await QQMusicApi.api('/user/detail', { uin: '12345', size: '256' });

  assert.deepEqual(result, {
    data: {
      code: 0,
      data: {
        avatarUrl: 'https://q.qlogo.cn/headimg_dl?dst_uin=12345&spec=256',
        message: 'ok',
      },
    },
  });
});

test('QQMusicApi.api returns resolved avatar payload for k-based user detail route', async () => {
  const result = await QQMusicApi.api('/user/detail', { k: 'token-123', size: '100' });

  assert.deepEqual(result, {
    data: {
      code: 0,
      data: {
        avatarUrl: 'https://thirdqq.qlogo.cn/g?b=sdk&k=token-123&s=100',
        message: 'ok',
      },
    },
  });
});

test('QQMusicApi.api returns normalized bad request payload for invalid avatar size', async () => {
  const result = await QQMusicApi.api('/user/detail', { uin: '12345', size: '0' });

  assert.deepEqual(result, {
    data: {
      code: -1,
      msg: 'invalid size',
      data: null,
    },
  });
});

test('QQMusicApi.api returns normalized bad request payload for invalid radio id', async () => {
  const result = await QQMusicApi.api('/radio', { id: 'abc' });

  assert.deepEqual(result, {
    data: {
      code: -1,
      msg: 'invalid radio id',
      data: null,
    },
  });
});

test('QQMusicApi.api returns normalized bad request payload for missing user songlist uin', async () => {
  const result = await QQMusicApi.api('/user/songlist');

  assert.deepEqual(result, {
    data: {
      code: -1,
      msg: 'missing uin',
      data: null,
    },
  });
});

test('QQMusicApi.api returns normalized empty payload for missing search key', async () => {
  const result = await QQMusicApi.api('/search');

  assert.deepEqual(result, {
    data: {
      list: [],
      totalnum: 0,
    },
  });
});

test('QQMusicApi.api returns normalized bad request payload for missing lyric songmid', async () => {
  const result = await QQMusicApi.api('/lyric');

  assert.deepEqual(result, {
    data: {
      code: -1,
      msg: 'missing songmid',
      data: null,
    },
  });
});

test('QQMusicApi.api returns normalized bad request payload for missing avatar identity', async () => {
  const result = await QQMusicApi.api('/user/detail', { size: '140' });

  assert.deepEqual(result, {
    data: {
      code: -1,
      msg: 'missing k or uin',
      data: null,
    },
  });
});

test('QQMusicApi.api returns normalized bad request payload for invalid avatar size', async () => {
  const result = await QQMusicApi.api('/user/detail', { uin: '12345', size: '0' });

  assert.deepEqual(result, {
    data: {
      code: -1,
      msg: 'invalid size',
      data: null,
    },
  });
});
