import type { Controller } from '../types';
import { getSimilarSinger, getSingerDesc, getSingerMv, getSingerStarNum } from '../../module';
import { createMusicuPayload, getMusicu } from '../../module/apis/musicu';
import { errorLog } from '../../util/debug';

export const similarSingerController: Controller = async (ctx) => {
  const { singermid: singer_mid } = ctx.query;

  const props = {
    method: 'get',
    params: {
      singer_mid
    },
    option: {}
  };

  if (singer_mid) {
    const { status, body } = await getSimilarSinger(props);
    Object.assign(ctx, {
      status,
      body
    });
  } else {
    ctx.status = 400;
    ctx.body = {
      response: 'no singermid'
    };
  }
};

export const singerDescController: Controller = async (ctx) => {
  const { singermid } = ctx.query;

  const props = {
    method: 'get',
    params: {
      singermid
    },
    option: {}
  };

  if (singermid) {
    const { status, body } = await getSingerDesc(props);
    Object.assign(ctx, {
      status,
      body
    });
  } else {
    ctx.status = 400;
    ctx.body = {
      status: 400,
      response: 'no singermid'
    };
  }
};

export const singerMvController: Controller = async (ctx) => {
  const { singermid, order, num = 5 } = ctx.query;
  const orderStr = Array.isArray(order) ? order[0] : order;

  const params: Record<string, any> = {
    singermid,
    order: orderStr,
    num,
    ...(orderStr && orderStr.toLowerCase() === 'time' ? { cmd: 1 } : {})
  };

  const props = {
    method: 'get',
    params,
    option: {}
  };

  if (singermid) {
    const { status, body } = await getSingerMv(props);
    Object.assign(ctx, {
      status,
      body
    });
  } else {
    ctx.status = 400;
    ctx.body = {
      response: 'no singermid'
    };
  }
};

export const singerStarNumController: Controller = async (ctx) => {
  const { singermid } = ctx.query;

  const props = {
    method: 'get',
    params: {
      singermid
    },
    option: {}
  };

  if (singermid) {
    const { status, body } = await getSingerStarNum(props);
    Object.assign(ctx, {
      status,
      body
    });
  } else {
    ctx.status = 400;
    ctx.body = {
      response: 'no singermid'
    };
  }
};

export const singerAlbumController: Controller = async (ctx) => {
  const singermid = ctx.query.singermid as string;
  const num = +ctx.query.limit || 5;
  const begin = +ctx.query.page || 0;

  const params = {
    format: 'json',
    singermid,
    data: JSON.stringify(createMusicuPayload({
      singer: {
        method: 'GetAlbumList',
        param: {
          sort: 5,
          singermid,
          begin,
          num
        },
        module: 'music.musichallAlbum.AlbumListServer'
      }
    }, { ct: 24, cv: 0 }))
  };

  if (!singermid) {
    ctx.status = 400;
    ctx.body = {
      response: 'no singermid'
    };
    return;
  }

  try {
    const res = await getMusicu(params);
    ctx.status = 200;
    ctx.body = {
      response: res.data
    };
  } catch (error) {
    errorLog('singerControllers', 'singerAlbum error', error);
  }
};

export const singerHotsongController: Controller = async (ctx) => {
  const singermid = ctx.query.singermid as string;
  const num = +ctx.query.limit || 5;
  const page = +ctx.query.page || 0;

  const params = {
    format: 'json',
    singermid,
    data: JSON.stringify(createMusicuPayload({
      singer: {
        method: 'get_singer_detail_info',
        param: {
          sort: 5,
          singermid,
          sin: (page - 1) * num,
          num
        },
        module: 'music.web_singer_info_svr'
      }
    }, { ct: 24, cv: 0 }))
  };

  if (!singermid) {
    ctx.status = 400;
    ctx.body = {
      response: 'no singermid'
    };
    return;
  }

  try {
    const res = await getMusicu(params);
    ctx.status = 200;
    ctx.body = {
      response: res.data
    };
  } catch (error) {
    errorLog('singerControllers', 'singerHotsong error', error);
  }
};

export const singerListController: Controller = async (ctx) => {
  const { area = -100, sex = -100, genre = -100, index = -100, page = 1 } = ctx.query;

  const pageNum = Number(page);
  const params = {
    format: 'json',
    data: JSON.stringify(createMusicuPayload({
      singerList: {
        module: 'Music.SingerListServer',
        method: 'get_singer_list',
        param: {
          area: Number(area),
          sex: Number(sex),
          genre: Number(genre),
          index: Number(index),
          sin: (pageNum - 1) * 80,
          cur_page: pageNum
        }
      }
    }, { ct: 24, cv: 0 }))
  };

  try {
    const res = await getMusicu(params);
    ctx.status = 200;
    ctx.body = {
      status: 200,
      response: res.data
    };
  } catch (error) {
    errorLog('singerControllers', 'singerList error', error);
    ctx.status = 500;
    ctx.body = {
      error: 'internal server error'
    };
  }
};
