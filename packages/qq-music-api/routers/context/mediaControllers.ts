import type { Controller } from '../types';
import { getAlbumInfo, getLyric } from '../../module';
import { getFirstQueryValue, setBadRequest } from '../util';

export const albumInfoController: Controller = async (ctx) => {
  const albummid = getFirstQueryValue(ctx.query.albummid);

  const props = {
    method: 'get',
    params: {
      albummid
    },
    option: {}
  };

  if (!albummid) {
    setBadRequest(ctx, 'missing albummid');
    return;
  }

  const { status, body } = await getAlbumInfo(props);
  Object.assign(ctx, {
    status,
    body
  });
};

export const lyricController: Controller = async (ctx) => {
  const songmid = getFirstQueryValue(ctx.query.songmid);
  const rawIsFormat = getFirstQueryValue(ctx.query.isFormat);

  const props = {
    method: 'get',
    params: {
      songmid
    },
    option: {},
    isFormat: rawIsFormat
  };

  if (!songmid) {
    setBadRequest(ctx, 'missing songmid');
    return;
  }

  const { status, body } = await getLyric(props);
  Object.assign(ctx, {
    status,
    body
  });
};

export const imageUrlController: Controller = async (ctx) => {
  const { id, size = '300x300', maxAge = 2592000 } = ctx.query;

  if (!id) {
    setBadRequest(ctx, 'missing id');
    return;
  }

  ctx.status = 200;
  ctx.body = {
    response: {
      code: 0,
      data: {
        imageUrl: `https://y.gtimg.cn/music/photo_new/T002R${size}M000${id}.jpg?max_age=${maxAge}`
      }
    }
  };
};
