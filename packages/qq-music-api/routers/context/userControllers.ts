import type { Controller, KoaContext } from '../types';
import { getQQLoginQr, getUserAvatar, getUserLikedSongs, getUserPlaylists } from '../../module';
import { getFirstQueryValue, setBadRequest } from '../util';

export const qqLoginQrController: Controller = async (ctx) => {
  const props = {
    method: 'get'
  };

  const { status, body } = await getQQLoginQr(props);
  Object.assign(ctx, {
    status,
    body
  });
};

export const userPlaylistsController: Controller = async (ctx: KoaContext) => {
  const uin = getFirstQueryValue(ctx.query.id) || getFirstQueryValue(ctx.query.uin);
  const cookie = getFirstQueryValue(ctx.query.cookie) || '';
  const { offset = 0, limit = 30 } = ctx.query;

  if (!uin) {
    setBadRequest(ctx, 'missing uin');
    return;
  }

  const { status, body } = await getUserPlaylists({
    uin,
    offset: Number(offset),
    limit: Number(limit),
    cookie
  });

  Object.assign(ctx, {
    status,
    body
  });
};

export const userLikedSongsController: Controller = async (ctx, next) => {
  const uin = getFirstQueryValue(ctx.query.uin);
  const { offset = 0, limit = 30 } = ctx.query;

  if (!uin) {
    setBadRequest(ctx, 'missing uin');
    return;
  }

  const { status, body } = await getUserLikedSongs({
    uin,
    offset: Number(offset),
    limit: Number(limit)
  });

  Object.assign(ctx, {
    status,
    body
  });

  await next();
};

export const userAvatarController: Controller = async (ctx: KoaContext) => {
  const rawK = getFirstQueryValue(ctx.query.k);
  const rawUin = getFirstQueryValue(ctx.query.id) || getFirstQueryValue(ctx.query.uin);
  const rawSize = getFirstQueryValue(ctx.query.size);
  const parsedSize = rawSize ? Number(rawSize) : 140;

  if (!rawK && !rawUin) {
    setBadRequest(ctx, 'missing k or uin');
    return;
  }

  if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
    setBadRequest(ctx, 'invalid size');
    return;
  }

  try {
    const result = await getUserAvatar({
      k: rawK,
      uin: rawUin,
      size: parsedSize
    });

    ctx.status = 200;
    ctx.body = {
      response: {
        code: 0,
        data: {
          avatarUrl: result.avatarUrl,
          message: 'ok'
        }
      }
    };
  } catch (error) {
    ctx.status = 502;
    ctx.body = {
      response: {
        code: -1,
        msg: (error as Error).message
      }
    };
  }
};
