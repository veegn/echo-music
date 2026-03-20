import { AxiosRequestConfig, Method } from 'axios';
import request from '../../util/request';
import * as config from '../config';
import { debugLog, isDebugEnabled } from '../../util/debug';

interface UCommonOptions {
	options?: AxiosRequestConfig;
	method?: Method | string;
}

export default ({ options = {}, method = 'get' }: UCommonOptions) => {
	const opts: AxiosRequestConfig = { ...options };

	// Merge commonParams into params for query string
	opts.params = { ...config.commonParams, ...(opts.params || {}) };

	opts.headers = {
		referer: 'https://y.qq.com/portal/player.html',
		host: 'u.y.qq.com',
		'content-type': 'application/x-www-form-urlencoded',
		...(opts.headers || {})
	};

	if (isDebugEnabled()) {
		const logOpts = { ...opts, headers: { ...opts.headers, cookie: '[REDACTED]' } };
		debugLog('u_common', 'https://u.y.qq.com/cgi-bin/musicu.fcg', { opts: logOpts });
	}

	return request({
    url: 'https://u.y.qq.com/cgi-bin/musicu.fcg',
    method: method as Method,
    options: opts,
    isUUrl: 'u',
  });
};
