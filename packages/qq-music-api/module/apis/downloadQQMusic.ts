import { AxiosRequestConfig, Method } from 'axios';
import { handleApi } from '../../util/apiResponse';
import request from '../../util/request';

interface DownloadOptions {
	method?: Method | string;
	params?: any;
	option?: AxiosRequestConfig;
}

export default async ({ method = 'get', params = {}, option = {} }: DownloadOptions) => {
	const data = {
		...params,
		format: 'jsonp',
		jsonpCallback: 'MusicJsonCallback',
		platform: 'yqq'
	};
	const options: AxiosRequestConfig = {
		...option,
		headers: {
			host: 'y.qq.com',
			referer: 'https://y.qq.com/',
			...(option.headers || {})
		},
		params: data
	};

	return handleApi(
		request('/download/download.js', method as Method, options, 'y'),
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
};
