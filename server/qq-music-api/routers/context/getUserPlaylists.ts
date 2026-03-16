import { getUserPlaylists } from '../../module';

// 获取用户创建的歌单
export default async (ctx: any, next: any) => {
  const uin = (ctx.query.id || ctx.query.uin) as string;
  const cookie = (ctx.query.cookie || '') as string;
  const { offset = 0, limit = 30 } = ctx.query;

  if (!uin) {
    ctx.status = 400;
    ctx.body = {
      response: {
        code: -1,
        msg: '缺少 uin 参数'
      }
    };
    return;
  }

  const { status, body } = await getUserPlaylists({
    uin,
    offset: Number(offset),
    limit: Number(limit),
    cookie
  });

  Object.assign(ctx, {
    status,
    body
  });
};

