import type { Controller } from '../types';
import { getHotKey, getSearchByKey, getSmartbox } from '../../module';
import type { ApiResponse } from '../../types/api';
import { debugLog } from '../../util/debug';

export const hotKeyController: Controller = async (ctx) => {
	const props = {
		method: 'get',
		params: {},
		option: {}
	};

	debugLog('getHotkey', 'controller props', props);

	const { status, body } = await getHotKey(props);

	debugLog('getHotkey', 'controller response status', status);

	Object.assign(ctx, {
		status,
		body
	});
};

export const searchByKeyController: Controller = async (ctx) => {
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

export const smartboxController: Controller = async (ctx) => {
	const { key } = ctx.query;
	const props = {
		method: 'get',
		params: {
			key
		},
		option: {}
	};

	if (key) {
		const result = await getSmartbox(props) as ApiResponse;
		const { status, body } = result;
		Object.assign(ctx, {
			status,
			body
		});
	} else {
		ctx.status = 200;
		ctx.body = {
			response: null
		};
	}
};
