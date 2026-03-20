import type { Controller } from '../types';
import { songLists } from '../../module';
import { createMusicuPayload, getMusicu } from '../../module/apis/musicu';
import { errorLog } from '../../util/debug';

function getWeekNumber(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export const songInfoController: Controller = async (ctx) => {
  const song_mid = ctx.query.songmid as string;
  const song_id = ctx.query.songid || '';

  const params = {
    format: 'json',
    data: JSON.stringify(createMusicuPayload({
      songinfo: {
        method: 'get_song_detail_yqq',
        param: {
          song_type: 0,
          song_mid,
          song_id
        },
        module: 'music.pf_song_detail_svr'
      }
    }))
  };

  try {
    const res = await getMusicu(params);
    ctx.status = 200;
    ctx.body = {
      response: res.data
    };
  } catch (error) {
    errorLog('coreControllers', 'songInfo error', error);
  }
};

export const batchSongInfoController: Controller = async (ctx) => {
	const { songs } = ctx.request.body || {};

  const data = await Promise.all(
    (songs || []).map(async (song: any[]) => {
      const [song_mid, song_id = ''] = song;
      const res = await getMusicu({
        params: {
          format: 'json',
          data: JSON.stringify(createMusicuPayload({
            songinfo: {
              method: 'get_song_detail_yqq',
              param: {
                song_type: 0,
                song_mid,
                song_id
              },
              module: 'music.pf_song_detail_svr'
            }
          }))
        },
      });
      return res.data;
    })
  );

  Object.assign(ctx, {
    status: 200,
    body: {
      response: {
        code: 0,
        data
      }
    }
  });
};

export const batchSongListsController: Controller = async (ctx) => {
	const { limit: ein = 19, page: sin = 0, sortId = 5, categoryIds = [10000000] } = ctx.request.body || {};

  const params = {
    sortId,
    sin,
    ein
  };

  const props = {
    method: 'get',
    option: {},
    params
  };

  const data = await Promise.all(
    categoryIds.map(async (categoryId: number) => {
      const res = await songLists({
        ...props,
        params: {
          ...params,
          categoryId
        }
      });

      if (res.body.response && +res.body.response.code === 0) {
        return res.body.response.data;
      }

      return res.body.response;
    })
  );

  Object.assign(ctx, {
    body: {
      status: 200,
      data
    }
  });
};

export const newDisksController: Controller = async (ctx) => {
  const page = +ctx.query.page || 1;
  const num = +ctx.query.limit || 20;
  const start = (page - 1) * num;

  const data: any = {
    new_album: {
      module: 'newalbum.NewAlbumServer',
      method: 'get_new_album_info',
      param: {
        area: 1,
        start,
        num
      }
    }
  };

  if (!start) {
    data.new_album_tag = {
      module: 'newalbum.NewAlbumServer',
      method: 'get_new_album_area',
      param: {}
    };
  }

  const params = {
    format: 'json',
    data: JSON.stringify(createMusicuPayload(data, { ct: 24, cv: 0 }))
  };

  try {
    const res = await getMusicu(params);
    ctx.status = 200;
    ctx.body = {
      status: 200,
      response: res.data
    };
  } catch (error) {
    errorLog('coreControllers', 'newDisks error', error);
  }
};

export const ranksController: Controller = async (ctx) => {
  const topId = +ctx.query.topId || 4;
  const num = +ctx.query.limit || 20;
  const offset = +ctx.query.page || 0;

  const date = new Date();
  const week = getWeekNumber(date);
  const period = `${date.getFullYear()}_${week}`;

  const params = {
    format: 'json',
    data: JSON.stringify(createMusicuPayload({
      req_1: {
        module: 'musicToplist.ToplistInfoServer',
        method: 'GetDetail',
        param: {
          topId,
          offset,
          num,
          period
        }
      }
    }, {
      ct: 24,
      cv: 4747474,
      format: 'json',
      inCharset: 'utf-8',
      needNewCode: 1,
      uin: 0
    }))
  };

  try {
    const res = await getMusicu(params);
    ctx.status = 200;
    ctx.body = {
      response: res.data
    };
  } catch (error) {
    errorLog('coreControllers', 'ranks error', error);
  }
};

export const ticketInfoController: Controller = async (ctx) => {
  const params = {
    format: 'json',
    inCharset: 'utf8',
    outCharset: 'GB2312',
    platform: 'yqq.json',
    data: JSON.stringify(createMusicuPayload({
      getFirstData: {
        module: 'mall.ticket_index_page_svr',
        method: 'GetTicketIndexPage',
        param: {
          city_id: -1
        }
      },
      getTag: {
        module: 'mall.ticket_index_page_svr',
        method: 'GetShowTypeList',
        param: {}
      }
    }, { ct: 24, cv: 0 }))
  };

  try {
    const res = await getMusicu(params);
    ctx.status = 200;
    ctx.body = {
      response: res.data
    };
  } catch (error) {
    errorLog('coreControllers', 'ticketInfo error', error);
  }
};
