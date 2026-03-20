import request from '../../util/request';
import { handleApi } from '../../util/apiResponse';
import type { ApiOptions } from '../../types/api';
import { lyricParse } from '../../util/lyricParse';
import { buildQueryOptions } from './queryOptions';

export async function getMvByTag({ method = 'get', params = {}, option = {} }: ApiOptions) {
  const options = buildQueryOptions(params, option, {
    format: 'json',
    outCharset: 'GB2312',
    cmd: 'shoubo',
    lan: 'all'
  });

  return handleApi(
    request({
      url: '/mv/fcgi-bin/getmv_by_tag',
      method: method as import('axios').Method,
      options
    })
  );
}

export async function getRadioLists({ method = 'get', params = {}, option = {} }: ApiOptions) {
  const options = buildQueryOptions(params, option, {
    format: 'json',
    outCharset: 'utf-8',
    channel: 'radio',
    page: 'index',
    tpl: 'wk',
    new: 1,
    p: Math.round(1)
  });

  return handleApi(
    request({
      url: '/v8/fcg-bin/fcg_v8_radiolist.fcg',
      method: method as import('axios').Method,
      options
    })
  );
}

export async function getDigitalAlbumLists({ method = 'get', params = {}, option = {} }: ApiOptions) {
  const options = buildQueryOptions(params, option, {
    format: 'json',
    outCharset: 'utf-8',
    cmd: 'pc_index_new'
  });

  return handleApi(
    request({
      url: '/v8/fcg-bin/musicmall.fcg',
      method: method as import('axios').Method,
      options
    })
  );
}

export async function getLyric({ method = 'get', params = {}, option = {}, isFormat = false }: ApiOptions) {
  const options = buildQueryOptions(params, option, {
    format: 'json',
    outCharset: 'utf-8',
    pcachetime: Date.now()
  });

  return handleApi(
    request({
      url: '/lyric/fcgi-bin/fcg_query_lyric_new.fcg',
      method: method as import('axios').Method,
      options
    }),
    {
      transformData: (resData: Record<string, any>) => {
        const lyricString = resData && resData.lyric && Buffer.from(resData.lyric, 'base64').toString();
        const lyric = isFormat && lyricString ? lyricParse(lyricString) : lyricString;
        return {
          ...resData,
          lyric
        };
      }
    }
  );
}

export async function getTopLists({ method = 'get', params = {}, option = {} }: ApiOptions) {
  const options = buildQueryOptions(params, option, {
    format: 'json',
    outCharset: 'utf-8',
    platform: 'h5',
    needNewCode: 1
  });

  return handleApi(
    request({
      url: '/v8/fcg-bin/fcg_myqq_toplist.fcg',
      method: method as import('axios').Method,
      options,
      isUUrl: 'c'
    }),
    {
      transformData: (response: unknown) => {
        if (typeof response === 'string') {
          const reg = /^\w+\(({[^()]+})\)$/;
          const matches = response.match(reg);
          if (matches) {
            return JSON.parse(matches[1]);
          }
        }
        return response;
      }
    }
  );
}
