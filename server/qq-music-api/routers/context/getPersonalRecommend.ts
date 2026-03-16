import { Context } from 'koa'
import recommendApi from '../../module/apis/recommend/getPersonalRecommend'

/**
 * 获取个性化推荐
 */
export async function getPersonalRecommendController(ctx: Context) {
  const { type = '1', cookie } = ctx.query

  // 处理数组类型，取第一个值
  const rawType = Array.isArray(type) ? type[0] : type
  const rawCookie = Array.isArray(cookie) ? cookie[0] : cookie

  const result = await recommendApi.getPersonalRecommend(Number(rawType), rawCookie)

  ctx.status = result.status
  // Standardize output: elevate the specific recommendation data if present
  const body = result.body as any;
  const payload = body?.response || body;
  const dataKey = type === '2' ? 'radio' : (type === '3' ? 'mv' : 'recomPlaylist');
  
  if (payload && payload[dataKey]) {
    ctx.body = {
      response: {
        code: 0,
        ...payload[dataKey]
      }
    };
  } else {
    ctx.body = result.body;
  }
}

/**
 * 获取相似歌曲
 */
export async function getSimilarSongsController(ctx: Context) {
  const { songmid, cookie } = ctx.query

  if (!songmid) {
    ctx.status = 400
    ctx.body = {
      code: -1,
      msg: '缺少参数 songmid',
      data: null
    }
    return
  }

  // 处理数组类型，取第一个值
  const validSongmid = Array.isArray(songmid) ? songmid[0] : songmid
  
  // 校验空字符串
  if (!validSongmid || String(validSongmid).trim() === '') {
    ctx.status = 400
    ctx.body = {
      code: -1,
      msg: '参数 songmid 不能为空',
      data: null
    }
    return
  }

  const result = await recommendApi.getSimilarSongs(String(validSongmid), cookie as string)

  ctx.status = result.status
  ctx.body = result.body
}

export default {
  getPersonalRecommend: getPersonalRecommendController,
  getSimilarSongs: getSimilarSongsController
}
