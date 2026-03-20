import { Controller } from '../types';
import { createMusicuPayload, getMusicu } from '../../module/apis/musicu';
import { errorLog } from '../../util/debug';
import { setBadRequest, setInternalError } from '../util';

const controller: Controller = async (ctx) => {
  const { vid } = ctx.query;
  
  const data = {
    getMVUrl: {
      module: 'gosrf.Stream.MvUrlProxy',
      method: 'GetMvUrls',
      param: {
        vids: [vid],
        request_typet: 10001
      }
    },
    mvinfo: {
      module: 'video.VideoDataServer',
      method: 'get_video_info_batch',
      param: {
        vidlist: [vid],
        required: [
          'vid', 'type', 'sid', 'cover_pic', 'duration', 'singers',
          'video_switch', 'msg', 'name', 'desc', 'playcnt', 'pubdate',
          'isfav', 'gmid'
        ]
      }
    },
    other: {
      module: 'video.VideoLogicServer',
      method: 'rec_video_byvid',
      param: {
        vid,
        required: [
          'vid', 'type', 'sid', 'cover_pic', 'duration', 'singers',
          'video_switch', 'msg', 'name', 'desc', 'playcnt', 'pubdate',
          'isfav', 'gmid', 'uploader_headurl', 'uploader_nick',
          'uploader_encuin', 'uploader_uin', 'uploader_hasfollow',
          'uploader_follower_num'
        ],
        support: 1
      }
    }
  };
  
  const params = {
    format: 'json',
    data: JSON.stringify(createMusicuPayload(data, { ct: 24, cv: 4747474 }))
  };
  
  if (!vid) {
    setBadRequest(ctx, 'missing vid');
    return;
  }

  try {
    const res = await getMusicu(params);
    const response = res.data;
    const mvurls = response?.getMVUrl?.data;

    if (!mvurls || typeof mvurls !== 'object' || Object.keys(mvurls).length === 0) {
      ctx.status = 502;
      ctx.body = {
        response: {
          data: null,
          error: 'Failed to get MV URL data'
        }
      };
      return;
    }

    const mvurlskey = Object.keys(mvurls)[0];
    const mp4Urls = mvurls[mvurlskey]?.mp4?.map((item: any) => item.freeflow_url) || [];
    const hlsUrls = mvurls[mvurlskey]?.hls?.map((item: any) => item.freeflow_url) || [];
    const urls = [...mp4Urls, ...hlsUrls];

    let playUrls: string[] = [];
    let playLists: Record<string, string[]> = {};

    if (urls.length) {
      urls.forEach((urlGroup: string[]) => {
        playUrls = [...playUrls, ...urlGroup];
      });
      playLists = {
        f10: playUrls.filter((item: string) => /\.f10\.mp4/.test(item)),
        f20: playUrls.filter((item: string) => /\.f20\.mp4/.test(item)),
        f30: playUrls.filter((item: string) => /\.f30\.mp4/.test(item)),
        f40: playUrls.filter((item: string) => /\.f40\.mp4/.test(item))
      };
    }

    response.playLists = playLists;
    ctx.status = 200;
    ctx.body = {
      response
    };
  } catch (error) {
    errorLog('getMvPlay', 'request error', error);
    setInternalError(ctx, 'failed to load mv play data');
  }
};

export default controller;
