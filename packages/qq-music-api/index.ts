import contextRouter from './routers/context/index';
import { errorLog } from './util/debug';

const routeToHandler = {
  '/lyric': 'getLyric',
  '/private/fm': 'getPrivateFM',
  '/radio': 'getRadioTracks',
  '/radio/category': 'getRadioLists',
  '/recommend/daily': 'getDailyRecommend',
  '/recommend/playlist/u': 'getPersonalRecommend',
  '/search': 'getSearchByKey',
  '/search/hot': 'getHotKey',
  '/song/url': 'getMusicPlay',
  '/songlist': 'getSongListDetail',
  '/songs/new': 'getNewSongs',
  '/user/detail': 'getUserAvatar',
  '/user/songlist': 'getUserPlaylists',
} as const;

type ContextRouter = typeof contextRouter;
type HandlerName = keyof ContextRouter;
type MockContext = {
  query: Record<string, any>;
  params: Record<string, any>;
  request: { body: Record<string, any> };
  body: any;
  status: number;
};

export function buildMockContext(params: Record<string, any>): MockContext {
  return {
    query: { ...params, cookie: params.cookie },
    params: { ...params, cookie: params.cookie },
    request: { body: params },
    body: undefined,
    status: 200,
  };
}

export function normalizeSongUrlPayload(path: string, ctx: MockContext) {
  if (path !== '/song/url') {
    return null;
  }

  const playUrl = ctx.body?.data?.playUrl || ctx.body?.response?.playUrl || {};
  if (Object.keys(playUrl).length === 0) {
    return null;
  }

  const data: Record<string, string> = {};
  Object.keys(playUrl).forEach((key) => {
    data[key] = playUrl[key].url;
  });

  return { data };
}

export default {
  api: async function(path: string, params: Record<string, any> = {}) {
    const handlerName = routeToHandler[path as keyof typeof routeToHandler] as HandlerName | undefined;

    if (!handlerName || !contextRouter[handlerName]) {
      console.warn(`[QQMusic API Mock] Unmapped route: ${path}`);
      return { data: null };
    }

    const ctx = buildMockContext(params);
    const handler = contextRouter[handlerName];

    try {
      await handler(ctx, async () => {});
    } catch (err) {
      errorLog('QQMusic API Mock', `Error in ${handlerName}`, err);
    }

    const normalizedSongUrl = normalizeSongUrlPayload(path, ctx);
    if (normalizedSongUrl) {
      return normalizedSongUrl;
    }

    const payload = ctx.body?.response ?? ctx.body?.data ?? ctx.body;
    return { data: payload };
  }
};

export { routeToHandler };
