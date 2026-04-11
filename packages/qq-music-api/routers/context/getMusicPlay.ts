import { Controller } from '../types';
import { createMusicuPayload, getMusicu } from '../../module/apis/musicu';
import { errorLog } from '../../util/debug';

const ALLOWED_QUALITIES = ['m4a', 128, 320, 'ape', 'flac'];
const DEFAULT_QUALITY = 128;
const QUALITY_FALLBACK_ORDER: Array<string | number> = ['flac', 320, 128];
const GUID = '1429839143';
const SIGN = 'zzannc1o6o9b4i971602f3554385022046ab796512b7012';

const FILE_TYPE: Record<string, { s: string; e: string }> = {
  m4a: { s: 'C400', e: '.m4a' },
  128: { s: 'M500', e: '.mp3' },
  320: { s: 'M800', e: '.mp3' },
  ape: { s: 'A000', e: '.ape' },
  flac: { s: 'F000', e: '.flac' },
};

const parseQuality = (quality: any): string | number => {
  const parsed = parseInt(quality, 10) || quality;
  return ALLOWED_QUALITIES.includes(parsed) ? parsed : DEFAULT_QUALITY;
};

function extractUinFromCookie(cookie: string): string {
  const match = cookie.match(/(?:^|;)\s*uin=([^;]+)/)
    || cookie.match(/(?:^|;)\s*p_uin=([^;]+)/);
  return match ? match[1].replace(/^o0*/, '') : '0';
}

function buildRequestParams(
  songmidList: string[],
  mediaId: unknown,
  uin: string,
  quality: string | number,
) {
  const fileInfo = FILE_TYPE[String(quality)];
  const filename = songmidList.map((songmid) => `${fileInfo.s}${songmid}${mediaId || songmid}${fileInfo.e}`);

  const payload = createMusicuPayload({
    req_0: {
      module: 'vkey.GetVkeyServer',
      method: 'CgiGetVkey',
      param: {
        filename,
        guid: GUID,
        songmid: songmidList,
        songtype: [0],
        uin,
        loginflag: 1,
        platform: '20',
      },
    },
  }, { uin, format: 'json', ct: 24, cv: 0, loginUin: uin });

  return {
    format: 'json',
    sign: SIGN,
    data: JSON.stringify(payload),
  };
}

function buildPlayUrl(response: any, quality: string | number) {
  const domain = response?.req_0?.data?.sip?.filter?.((item: string) => !item.startsWith('http://ws'))?.[0]
    || response?.req_0?.data?.sip?.[0];

  const playUrl: Record<string, { url: string; error?: string; quality?: string | number }> = {};
  (response?.req_0?.data?.midurlinfo || []).forEach((item: any) => {
    playUrl[item.songmid] = {
      url: item.purl ? `${domain}${item.purl}` : '',
      error: !item.purl ? '暂无播放链接' : undefined,
      quality: item.purl ? quality : undefined,
    };
  });
  return playUrl;
}

const controller: Controller = async (ctx) => {
  const songmid = String(ctx.query.id || '');
  const cookieStr = String(ctx.query.cookie || '');
  const uin = cookieStr ? extractUinFromCookie(cookieStr) : ((global as any).userInfo?.uin || '0');
  const justPlayUrl = (ctx.query.resType || 'play') === 'play';
  const { mediaId } = ctx.query;
  const requestedQuality = parseQuality(ctx.query.quality);
  const songmidList = songmid ? songmid.split(',') : [];

  if (!songmid) {
    ctx.status = 400;
    ctx.body = { data: { message: 'no songmid' } };
    return;
  }

  const qualityOrder = ctx.query.quality ? [requestedQuality] : QUALITY_FALLBACK_ORDER;

  try {
    let response: any = null;
    let playUrl: Record<string, { url: string; error?: string; quality?: string | number }> = {};
    let resolvedQuality: string | number = requestedQuality;
    let pendingSongmids = [...songmidList];

    // 修复：多首歌曲请求时，应分别记录成功获取到 URL 的歌曲，而未获取到的歌曲继续循环往低音质 fallback，
    // 以免其中一首歌具有 flac，而导致另一首歌提前 break 从而彻底失去拿 128k 链接的机会。
    for (const quality of qualityOrder) {
      if (pendingSongmids.length === 0) break;

      const params = buildRequestParams(pendingSongmids, mediaId, uin, quality);
      const res = await getMusicu(params, cookieStr ? { cookie: cookieStr } : undefined);
      const nextResponse = res.data;
      const nextPlayUrl = buildPlayUrl(nextResponse, quality);

      if (!response) response = nextResponse; // 保留首次请求的对象主体
      resolvedQuality = quality;

      // 合并这轮拿到的播放链接
      for (const [mid, info] of Object.entries(nextPlayUrl)) {
        if (!playUrl[mid]?.url && info.url) {
          playUrl[mid] = info;
        } else if (!playUrl[mid]) {
          playUrl[mid] = info; // 至少保留错误信息用于保底
        }
      }

      // 将尚未解析到 URL 的歌曲筛出来，放到下一轮更低音质的请求中重新获取
      pendingSongmids = pendingSongmids.filter((mid) => !playUrl[mid]?.url);
    }

    response.playUrl = playUrl;
    response.resolvedQuality = resolvedQuality;
    ctx.body = {
      data: justPlayUrl
        ? { playUrl, quality: resolvedQuality }
        : response,
    };
  } catch (error) {
    errorLog('getMusicPlay', 'request error', error);
    ctx.status = 500;
    ctx.body = { data: { playUrl: {} } };
  }
};

export default controller;
