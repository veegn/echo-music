import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMockContext } from '../index';
import {
  commentsController,
  createEmptyMockContext,
  radioTracksController,
  similarSongsController,
} from '../routers/context/discoveryControllers';
import { imageUrlController, lyricController } from '../routers/context/mediaControllers';
import {
  similarSingerController,
  singerAlbumController,
  singerDescController,
  singerHotsongController,
  singerMvController,
  singerStarNumController,
} from '../routers/context/singerControllers';
import { searchByKeyController, smartboxController } from '../routers/context/searchControllers';
import {
  userAvatarController,
  userLikedSongsController,
  userPlaylistsController,
} from '../routers/context/userControllers';

test('commentsController rejects missing id', async () => {
  const ctx = createEmptyMockContext();

  await commentsController(ctx, async () => {});

  assert.equal(ctx.status, 400);
  assert.deepEqual(ctx.body, {
    response: {
      code: -1,
      msg: 'missing id or rootcommentid',
      data: null,
    },
  });
});

test('radioTracksController rejects invalid numeric id', async () => {
  const ctx = buildMockContext({ id: 'abc' });

  await radioTracksController(ctx as any);

  assert.equal(ctx.status, 400);
  assert.deepEqual(ctx.body, {
    response: {
      code: -1,
      msg: 'invalid radio id',
      data: null,
    },
  });
});

test('lyricController rejects missing songmid', async () => {
  const ctx = createEmptyMockContext();

  await lyricController(ctx, async () => {});

  assert.equal(ctx.status, 400);
  assert.deepEqual(ctx.body, {
    response: {
      code: -1,
      msg: 'missing songmid',
      data: null,
    },
  });
});

test('imageUrlController builds deterministic image url', async () => {
  const ctx = buildMockContext({ id: '001abc', size: '500x500', maxAge: '3600' });

  await imageUrlController(ctx as any, async () => {});

  assert.equal(ctx.status, 200);
  assert.deepEqual(ctx.body, {
    response: {
      code: 0,
      data: {
        imageUrl: 'https://y.gtimg.cn/music/photo_new/T002R500x500M000001abc.jpg?max_age=3600',
      },
    },
  });
});

test('imageUrlController rejects missing id', async () => {
  const ctx = createEmptyMockContext();

  await imageUrlController(ctx as any, async () => {});

  assert.equal(ctx.status, 400);
  assert.deepEqual(ctx.body, {
    response: {
      code: -1,
      msg: 'missing id',
      data: null,
    },
  });
});

test('userPlaylistsController rejects missing uin', async () => {
  const ctx = createEmptyMockContext();

  await userPlaylistsController(ctx, async () => {});

  assert.equal(ctx.status, 400);
  assert.deepEqual(ctx.body, {
    response: {
      code: -1,
      msg: 'missing uin',
      data: null,
    },
  });
});

test('userLikedSongsController rejects missing uin', async () => {
  const ctx = createEmptyMockContext();

  await userLikedSongsController(ctx as any, async () => {});

  assert.equal(ctx.status, 400);
  assert.deepEqual(ctx.body, {
    response: {
      code: -1,
      msg: 'missing uin',
      data: null,
    },
  });
});

test('userAvatarController rejects missing k and uin', async () => {
  const ctx = createEmptyMockContext();

  await userAvatarController(ctx, async () => {});

  assert.equal(ctx.status, 400);
  assert.deepEqual(ctx.body, {
    response: {
      code: -1,
      msg: 'missing k or uin',
      data: null,
    },
  });
});

test('userAvatarController rejects invalid size', async () => {
  const ctx = buildMockContext({ uin: '12345', size: '0' });

  await userAvatarController(ctx as any, async () => {});

  assert.equal(ctx.status, 400);
  assert.deepEqual(ctx.body, {
    response: {
      code: -1,
      msg: 'invalid size',
      data: null,
    },
  });
});

test('searchByKeyController returns normalized empty payload when key is missing', async () => {
  const ctx = createEmptyMockContext();

  await searchByKeyController(ctx as any);

  assert.equal(ctx.status, 400);
  assert.deepEqual(ctx.body, {
    response: {
      list: [],
      totalnum: 0,
    },
  });
});

test('smartboxController returns null response when key is missing', async () => {
  const ctx = createEmptyMockContext();

  await smartboxController(ctx as any);

  assert.equal(ctx.status, 200);
  assert.deepEqual(ctx.body, {
    response: null,
  });
});

test('similarSongsController rejects missing songmid', async () => {
  const ctx = createEmptyMockContext();

  await similarSongsController(ctx as any);

  assert.equal(ctx.status, 400);
  assert.deepEqual(ctx.body, {
    response: {
      code: -1,
      msg: 'missing songmid',
      data: null,
    },
  });
});

test('similarSingerController rejects missing singermid', async () => {
  const ctx = createEmptyMockContext();

  await similarSingerController(ctx as any);

  assert.equal(ctx.status, 400);
  assert.deepEqual(ctx.body, {
    response: 'no singermid',
  });
});

test('singerDescController rejects missing singermid', async () => {
  const ctx = createEmptyMockContext();

  await singerDescController(ctx as any);

  assert.equal(ctx.status, 400);
  assert.deepEqual(ctx.body, {
    status: 400,
    response: 'no singermid',
  });
});

test('singerMvController rejects missing singermid', async () => {
  const ctx = createEmptyMockContext();

  await singerMvController(ctx as any);

  assert.equal(ctx.status, 400);
  assert.deepEqual(ctx.body, {
    response: 'no singermid',
  });
});

test('singerStarNumController rejects missing singermid', async () => {
  const ctx = createEmptyMockContext();

  await singerStarNumController(ctx as any);

  assert.equal(ctx.status, 400);
  assert.deepEqual(ctx.body, {
    response: 'no singermid',
  });
});

test('singerAlbumController rejects missing singermid', async () => {
  const ctx = createEmptyMockContext();

  await singerAlbumController(ctx as any);

  assert.equal(ctx.status, 400);
  assert.deepEqual(ctx.body, {
    response: 'no singermid',
  });
});

test('singerHotsongController rejects missing singermid', async () => {
  const ctx = createEmptyMockContext();

  await singerHotsongController(ctx as any);

  assert.equal(ctx.status, 400);
  assert.deepEqual(ctx.body, {
    response: 'no singermid',
  });
});
