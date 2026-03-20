import type { Controller } from '../types';
import {
  getDigitalAlbumLists,
  getRadioLists,
  getTopLists,
  songListCategories,
  songListDetail,
  songLists
} from '../../module';

export const songListCategoriesController: Controller = async (ctx) => {
	const props = {
		method: 'get',
		params: {},
		option: {}
	};
	const { status, body } = await songListCategories(props);
	Object.assign(ctx, {
		status,
		body
	});
};

export const songListsController: Controller = async (ctx) => {
  const { limit = 20, page = 0, sortId = 5, categoryId = 10000000 } = ctx.query;

  const sin = +page * +limit;
  const ein = +limit * (+page + 1) - 1;

  const props = {
    method: 'get',
    params: {
      categoryId,
      sortId,
      sin,
      ein
    },
    option: {}
  };

  const { status, body } = await songLists(props);
  Object.assign(ctx, {
    status,
    body
  });
};

export const songListDetailController: Controller = async (ctx) => {
  const disstid = (ctx.query.id || ctx.query.disstid) as string;
  const cookie = (ctx.query.cookie || '') as string;

  const props = {
    method: 'get',
    params: {
      disstid
    },
    option: cookie ? { headers: { Cookie: cookie } } : {}
  };

  const { status, body } = await songListDetail(props);
  Object.assign(ctx, {
    status,
    body
  });
};

export const radioListsController: Controller = async (ctx) => {
  const props = {
    method: 'get',
    params: {},
    option: {}
  };

  const { status, body } = await getRadioLists(props);
  Object.assign(ctx, {
    status,
    body
  });
};

export const digitalAlbumListsController: Controller = async (ctx) => {
  const props = {
    method: 'get',
    params: {},
    option: {}
  };

  const { status, body } = await getDigitalAlbumLists(props);
  Object.assign(ctx, {
    status,
    body
  });
};

export const topListsController: Controller = async (ctx) => {
  const props = {
    method: 'get',
    params: {},
    option: {}
  };

  const { status, body } = await getTopLists(props);
  Object.assign(ctx, {
    status,
    body
  });
};
