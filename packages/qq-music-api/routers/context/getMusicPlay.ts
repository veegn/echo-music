import { KoaContext, Controller } from '../types';
import { createMusicuPayload, getMusicu } from '../../module/apis/musicu';
import { _guid } from '../../module/config';
import { errorLog } from '../../util/debug';

const ALLOWED_QUALITIES = ['m4a', 128, 320, 'ape', 'flac'];
const DEFAULT_QUALITY = 128;

const parseQuality = (quality: any): string | number => {
  const parsed = parseInt(quality) || quality;
  return ALLOWED_QUALITIES.includes(parsed) ? parsed : DEFAULT_QUALITY;
};

function extractUinFromCookie(cookie: string): string {
  const match = cookie.match(/(?:^|;)\s*uin=([^;]+)/)
    || cookie.match(/(?:^|;)\s*p_uin=([^;]+)/);
  return match ? match[1].replace(/^o0*/, '') : '0';
}

const controller: Controller = async (ctx, next) => {
  const songmid = (ctx.query.id || '') as string;
  const cookieStr = (ctx.query.cookie || '') as string;
  const uin = cookieStr ? extractUinFromCookie(cookieStr) : ((global as any).userInfo?.uin || '0');
  const justPlayUrl = (ctx.query.resType || 'play') === 'play';
  const guid = '1429839143';
  const { mediaId } = ctx.query;
  const quality = parseQuality(ctx.query.quality);

  const fileType: Record<string, { s: string; e: string }> = {
    m4a: { s: 'C400', e: '.m4a' },
    128: { s: 'M500', e: '.mp3' },
    320: { s: 'M800', e: '.mp3' },
    ape: { s: 'A000', e: '.ape' },
    flac: { s: 'F000', e: '.flac' }
  };

  const songmidList = songmid ? songmid.split(',') : [];
  const fileInfo = fileType[quality as string];
  const file = songmidList.map(_ => `${fileInfo.s}${_}${mediaId || _}${fileInfo.e}`);

  const data = createMusicuPayload({
    req_0: {
      module: 'vkey.GetVkeyServer',
      method: 'CgiGetVkey',
      param: {
        filename: file,
        guid,
        songmid: songmidList,
        songtype: [0],
        uin,
        loginflag: 1,
        platform: '20'
      }
    }
  }, { uin, format: 'json', ct: 24, cv: 0, loginUin: uin });

  const params = {
    format: 'json',
    sign: 'zzannc1o6o9b4i971602f3554385022046ab796512b7012',
    data: JSON.stringify(data)
  };

  if (songmid) {
    const makeRequest = async (q: string | number) => {
      const fi = fileType[q as string];
      const f = songmidList.map(_ => `${fi.s}${_}${mediaId || _}${fi.e}`);
      const reqData = createMusicuPayload({
        req_0: { module: 'vkey.GetVkeyServer', method: 'CgiGetVkey',
          param: { filename: f, guid, songmid: songmidList, songtype: [0], uin, loginflag: 1, platform: '20' }
        }
      }, { uin, format: 'json', ct: 24, cv: 0, loginUin: uin });
      const reqParams = { format: 'json', sign: 'zzannc1o6o9b4i971602f3554385022046ab796512b7012', data: JSON.stringify(reqData) };
      return getMusicu(reqParams, cookieStr ? { cookie: cookieStr } : undefined);
    };

    try {
      const res = await makeRequest(quality);
      const response = res.data;
      const domain = response?.req_0?.data?.sip?.filter?.((i: string) => !i.startsWith('http://ws'))?.[0] || response?.req_0?.data?.sip?.[0];

      const playUrl: Record<string, { url: string; error?: string }> = {};
      (response?.req_0?.data?.midurlinfo || []).forEach((item: any) => {
        playUrl[item.songmid] = {
          url: item.purl ? `${domain}${item.purl}` : '',
          error: !item.purl ? '暂无播放链接' : undefined
        };
      });

      response.playUrl = playUrl;
      ctx.body = { data: justPlayUrl ? { playUrl } : response };
    } catch (error) {
      errorLog('getMusicPlay', 'request error', error);
      ctx.status = 500;
      ctx.body = { data: { playUrl: {} } };
    }
  } else {
    ctx.status = 400;
    ctx.body = { data: { message: 'no songmid' } };
  }
};

export default controller;
