import { AxiosRequestConfig } from 'axios';
import { handleApi } from '../../util/apiResponse';
import { commonParams } from '../config';
import uCommon from './u_common';

type MusicuModuleRequest = {
  module: string;
  method: string;
  param: Record<string, any>;
};

type MusicuRequestMap = Record<string, MusicuModuleRequest>;

interface PostMusicuOptions {
  cookie?: string;
  headers?: AxiosRequestConfig['headers'];
  comm?: Record<string, any>;
}

interface GetMusicuOptions {
  cookie?: string;
  headers?: AxiosRequestConfig['headers'];
}

export function createMusicuPayload(
  requests: MusicuRequestMap,
  comm: Record<string, any> = {}
) {
  return {
    comm: {
      ...commonParams,
      ct: 24,
      cv: 0,
      ...comm,
    },
    ...requests,
  };
}

export function postMusicu(
  requests: MusicuRequestMap,
  options: PostMusicuOptions = {}
) {
  const headers: Record<string, any> = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  if (options.cookie) {
    headers.cookie = options.cookie;
  }

  return handleApi(
    uCommon({
      method: 'POST',
      options: {
        data: JSON.stringify(createMusicuPayload(requests, options.comm)),
        headers,
      },
    })
  );
}

export function getMusicu(
  params: Record<string, any>,
  options: GetMusicuOptions = {}
) {
  const headers: Record<string, any> = {
    ...(options.headers || {}),
  };

  if (options.cookie) {
    headers.Cookie = options.cookie;
  }

  return uCommon({
    method: 'get',
    options: {
      params,
      headers,
    },
  });
}
