import request from '../../util/request';
import { handleApi } from '../../util/apiResponse';
import type { ApiOptions } from '../../types/api';
import { buildQueryOptions } from './queryOptions';

export async function getSimilarSinger({ method = 'get', params = {}, option = {} }: ApiOptions) {
  const options = buildQueryOptions(params, option, {
    format: 'json',
    outCharset: 'utf-8',
    utf8: 1,
    start: 0,
    num: 5
  });

  return handleApi(
    request({
      url: '/v8/fcg-bin/fcg_v8_simsinger.fcg',
      method: method as import('axios').Method,
      options
    })
  );
}

export async function getSingerMv({ method = 'get', params = {}, option = {} }: ApiOptions) {
  const options = buildQueryOptions(params, option, {
    format: 'json',
    outCharset: 'utf-8',
    cid: 205360581,
    begin: 0
  });

  return handleApi(
    request({
      url: '/mv/fcgi-bin/fcg_singer_mv.fcg',
      method: method as import('axios').Method,
      options
    })
  );
}

export async function getSingerDesc({ method = 'get', params = {}, option = {} }: ApiOptions) {
  const options = buildQueryOptions(params, option, {
    format: 'xml',
    outCharset: 'utf-8',
    utf8: 1,
    r: Date.now()
  });

  return handleApi(
    request({
      url: '/splcloud/fcgi-bin/fcg_get_singer_desc.fcg',
      method: method as import('axios').Method,
      options,
      isUUrl: 'c'
    })
  );
}

export async function getSingerStarNum({ method = 'get', params = {}, option = {} }: ApiOptions) {
  const options = buildQueryOptions(params, option, {
    format: 'json',
    outCharset: 'utf-8',
    utf8: 1,
    rnd: Date.now()
  });

  return handleApi(
    request({
      url: '/rsc/fcgi-bin/fcg_order_singer_getnum.fcg',
      method: method as import('axios').Method,
      options
    })
  );
}
