import contextRouter from './routers/context/index';

export default {
  api: async function(path: string, params: Record<string, any> = {}) {
    let handlerName: string | undefined;

    switch(path) {
      case '/search': handlerName = 'getSearchByKey'; break;
      case '/song/url': handlerName = 'getMusicPlay'; break;
      case '/user/songlist': handlerName = 'getUserPlaylists'; break;
      case '/recommend/playlist/u': handlerName = 'getPersonalRecommend'; break;
      case '/recommend/daily': handlerName = 'getDailyRecommend'; break;
      case '/private/fm': handlerName = 'getPrivateFM'; break;
      case '/songs/new': handlerName = 'getNewSongs'; break;
      case '/lyric': handlerName = 'getLyric'; break;
      case '/songlist': handlerName = 'getSongListDetail'; break;
      case '/user/detail': handlerName = 'getUserAvatar'; break;
      case '/radio/category': handlerName = 'getRadioLists'; break;
      case '/radio': 
        if (String(params.id) === '99') {
          handlerName = 'getPersonalRecommend';
          params.type = '2'; // Radio type
        } else {
          handlerName = 'getRadioLists';
        }
        break;
      case '/search/hot': handlerName = 'getHotKey'; break;
    }

    if (!handlerName || !(contextRouter as any)[handlerName]) {
      console.warn(`[QQMusic API Mock] Unmapped route: ${path}`);
      return { data: null };
    }

    // Pass custom cookie explicitly through fake context requests
    const ctx = {
      query: { ...params, cookie: params.cookie },
      params: { ...params, cookie: params.cookie },
      request: { body: params },
      body: undefined as any,
      status: 200,
    };

    const handler = (contextRouter as any)[handlerName];
    try {
      await handler(ctx, async () => {});
    } catch (err) {
      console.error(`[QQMusic API Mock] Error in ${handlerName}`, err);
    }

    // jsososo struct compatibility shim for song urls
    if (path === '/song/url') {
      const playUrl = ctx.body?.data?.playUrl || ctx.body?.response?.playUrl || {};
      if (Object.keys(playUrl).length > 0) {
        const newFormatData: Record<string, string> = {};
        Object.keys(playUrl).forEach(key => {
          newFormatData[key] = playUrl[key].url;
        });
        return { data: newFormatData };
      }
    }

    // Unify to { data: ... } — preserve response payload as-is so
    // field names like 'list', 'songlist', 'tracks' remain accessible on data.*
    const payload = ctx.body?.response ?? ctx.body?.data ?? ctx.body;
    return { data: payload };
  }
};
