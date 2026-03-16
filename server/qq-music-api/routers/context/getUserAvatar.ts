import { getUserAvatar } from '../../module';

// 获取 QQ 用户头像
export default async (ctx: any, next: any) => {
  const rawK = Array.isArray(ctx.query.k) ? ctx.query.k[0] : ctx.query.k;
  const rawUin = (ctx.query.id || ctx.query.uin) as string;
  const rawSize = Array.isArray(ctx.query.size) ? ctx.query.size[0] : ctx.query.size;
  const parsedSize = rawSize ? Number(rawSize) : 140;

  if (!rawK && !rawUin) {
    ctx.status = 400;
    ctx.body = {
      response: {
        code: -1,
        msg: '缺少 k 或 uin 参数'
      }
    };
    return;
  }

  if (!Number.isFinite(parsedSize) || parsedSize <= 0) {
    ctx.status = 400;
    ctx.body = {
      response: {
        code: -1,
        msg: 'size 参数无效'
      }
    };
    return;
  }

  try {
    const result = await getUserAvatar({
      k: rawK,
      uin: rawUin,
      size: parsedSize
    });

    ctx.status = 200;
    ctx.body = {
      response: {
        code: 0,
        data: {
          avatarUrl: result.avatarUrl,
          message: '获取头像成功'
        }
      }
    };
  } catch (error) {
    ctx.status = 502;
    ctx.body = {
      response: {
        code: -1,
        msg: (error as Error).message
      }
    };
  }
};

