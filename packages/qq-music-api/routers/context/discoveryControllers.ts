import type { Controller, KoaContext } from '../types';
import { getComments, downloadQQMusic } from '../../module';
import * as recommendApi from '../../module/apis/recommendApis';
import radioTrackApi from '../../module/apis/getRadioTrack';
import { getFirstQueryValue, setBadRequest } from '../util';

export const commentsController: Controller = async (ctx) => {
  const {
    id,
    pagesize = 25,
    pagenum = 0,
    cid = 205360772,
    cmd = 8,
    reqtype = 2,
    biztype = 1,
    rootcommentid = !pagenum && ''
  } = ctx.query;

  const checkrootcommentid = !pagenum ? true : !!rootcommentid;
  const props = {
    method: 'get',
    params: {
      cid,
      reqtype,
      biztype,
      topid: id,
      cmd,
      pagenum,
      pagesize,
      lasthotcommentid: rootcommentid
    },
    option: {}
  };

  if (!id || !checkrootcommentid) {
    setBadRequest(ctx, 'missing id or rootcommentid');
    return;
  }

  const { status, body } = await getComments(props);
  Object.assign(ctx, {
    status,
    body
  });
};

export const downloadQQMusicController: Controller = async (ctx) => {
  const props = {
    method: 'get',
    params: {},
    option: {}
  };
  const result = await downloadQQMusic(props);
  const { status, body } = result;
  Object.assign(ctx, {
    status,
    body
  });
};

export async function dailyRecommendController(ctx: KoaContext) {
  const normalizedCookie = getFirstQueryValue(ctx.query.cookie);

  const result = await recommendApi.getDailyRecommend(normalizedCookie);
  ctx.status = result.status;
  ctx.body = result.body;
}

export async function privateFMController(ctx: KoaContext) {
  const normalizedCookie = getFirstQueryValue(ctx.query.cookie);

  const result = await recommendApi.getPrivateFM(normalizedCookie);
  ctx.status = result.status;
  ctx.body = result.body;
}

export async function newSongsController(ctx: KoaContext) {
  const { areaId = '5', limit = '20' } = ctx.query;
  const result = await recommendApi.getNewSongs(Number(areaId), Number(limit));

  ctx.status = result.status;
  ctx.body = result.body;
}

export async function personalRecommendController(ctx: KoaContext) {
  const { type = '1', cookie } = ctx.query;
  const rawType = getFirstQueryValue(type) || '1';
  const rawCookie = getFirstQueryValue(cookie);

  const result = await recommendApi.getPersonalRecommend(Number(rawType), rawCookie);
  ctx.status = result.status;

  const payload = result.body?.response || result.body;
  const dataKey = rawType === '2' ? 'radio' : (rawType === '3' ? 'mv' : 'recomPlaylist');

  if (payload && payload[dataKey]) {
    ctx.body = {
      response: {
        code: 0,
        ...payload[dataKey]
      }
    };
  } else {
    ctx.body = result.body;
  }
}

export async function similarSongsController(ctx: KoaContext) {
  const { songmid, cookie } = ctx.query;

  if (!songmid) {
    setBadRequest(ctx, 'missing songmid');
    return;
  }

  const validSongmid = getFirstQueryValue(songmid);
  if (!validSongmid || String(validSongmid).trim() === '') {
    setBadRequest(ctx, 'songmid is empty');
    return;
  }

  const rawCookie = getFirstQueryValue(cookie);
  const result = await recommendApi.getSimilarSongs(String(validSongmid), rawCookie);
  ctx.status = result.status;
  ctx.body = result.body;
}

export async function radioTracksController(ctx: KoaContext) {
  const { id = '99', cookie } = ctx.query;
  const rawId = getFirstQueryValue(id) || '99';
  const rawCookie = getFirstQueryValue(cookie);
  const numericId = Number(rawId);

  if (!Number.isFinite(numericId) || numericId <= 0) {
    setBadRequest(ctx, 'invalid radio id');
    return;
  }

  const result = await radioTrackApi.getRadioTrack(numericId, rawCookie);
  ctx.status = result.status;
  ctx.body = result.body;
}

export function createEmptyMockContext(): KoaContext {
  return {
    query: {},
    params: {},
    request: {},
    body: undefined,
    status: 200,
  };
}
