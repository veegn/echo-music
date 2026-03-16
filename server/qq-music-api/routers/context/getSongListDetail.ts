import { KoaContext, Controller } from '../types';
import { songListDetail } from '../../module';

const controller: Controller = async (ctx, next) => {
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

export default controller;
