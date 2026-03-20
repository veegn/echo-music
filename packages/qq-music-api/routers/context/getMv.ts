import { Controller } from '../types';
import { createMusicuPayload, getMusicu } from '../../module/apis/musicu';
import { errorLog } from '../../util/debug';
import { setBadRequest, setInternalError } from '../util';

const controller: Controller = async (ctx) => {
  const { area_id = 15, version_id = 7, limit = 20, page = 0 } = ctx.query;
  const start = (+page ? +page - 1 : 0) * +limit;
  
  const data = {
    mv_tag: {
      module: 'MvService.MvInfoProServer',
      method: 'GetAllocTag',
      param: {}
    },
    mv_list: {
      module: 'MvService.MvInfoProServer',
      method: 'GetAllocMvInfo',
      param: {
        start,
        limit: +limit,
        version_id,
        area_id,
        order: 1
      }
    }
  };
  
  const params = {
    format: 'json',
    data: JSON.stringify(createMusicuPayload(data, { ct: 24 }))
  };
  
  if (!version_id || !area_id) {
    setBadRequest(ctx, 'missing version_id or area_id');
    return;
  }

  try {
    const res = await getMusicu(params);
    ctx.status = 200;
    ctx.body = {
      response: res.data
    };
  } catch (error) {
    errorLog('getMv', 'request error', error);
    setInternalError(ctx, 'failed to load mv data');
  }
};

export default controller;
