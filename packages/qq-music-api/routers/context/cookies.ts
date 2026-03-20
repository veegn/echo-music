import type { Controller, KoaContext } from '../types';

type CookieContext = KoaContext & {
  request: KoaContext['request'] & {
    cookies?: string;
    header: Record<string, any>;
  };
};

const getCookieController: Controller = async (ctx, next) => {
  ctx.status = 200;
  ctx.body = {
    data: {
      code: 200,
      cookie: (global.userInfo as any).cookie,
      cookieList: (global.userInfo as any).cookieList,
      cookieObject: (global.userInfo as any).cookieObject,
    },
  };

  await next();
};

const setCookieController: Controller = async (ctx, next) => {
  const cookieCtx = ctx as CookieContext;
  cookieCtx.request.cookies = global.userInfo.cookie;
  cookieCtx.request.header['Access-Control-Allow-Origin'] = 'https://y.qq.com';
  cookieCtx.request.header['Access-Control-Allow-Methods'] = 'GET,PUT,POST,DELETE';
  cookieCtx.request.header['Access-Control-Allow-Headers'] = 'Content-Type';
  cookieCtx.request.header['Access-Control-Allow-Credentials'] = true;
  cookieCtx.body = {
    data: {
      code: 200,
      message: '操作成功',
    },
  };

  await next();
};

export default {
  get: getCookieController,
  set: setCookieController,
};
