import { KoaContext, Controller } from '../types';
import { getSearchByKey } from '../../module';

const controller: Controller = async (ctx, next) => {
  const w = ctx.query.key || ctx.params.key;
  const { limit: n, page: p, catZhida, remoteplace = 'song' } = ctx.query;

  const props = {
    method: 'get',
    params: {
      w,
      n: +n || 10,
      p: +p || 1,
      catZhida: +catZhida || 1,
      remoteplace: `txt.yqq.${remoteplace}`
    },
    option: {}
  };

  if (w) {
    const { status, body } = await getSearchByKey(props);
    const songData = body?.response?.data?.song ?? body?.response?.song ?? {};
    ctx.status = status;
    ctx.body = {
      response: {
        list: songData.list || [],
        totalnum: songData.totalnum || 0,
        curnum: songData.curnum || 0,
        curpage: songData.curpage || 1,
      }
    };
  } else {
    ctx.status = 400;
    ctx.body = { response: { list: [], totalnum: 0 } };
  }
};

export default controller;
