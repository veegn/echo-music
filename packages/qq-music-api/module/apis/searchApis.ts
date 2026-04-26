import type { AxiosRequestConfig, Method } from 'axios';
import type { ApiOptions } from '../../types/api';
import { handleApi } from '../../util/apiResponse';
import y_common from './y_common';

interface GetSmartboxOptions {
	method?: Method | string;
	params?: any;
	option?: AxiosRequestConfig;
}

export async function getHotKey({ method = 'get', params = {}, option = {} }: ApiOptions) {
	const data = {
		...params,
		format: 'json',
		outCharset: 'utf-8',
		hostUin: 0,
		needNewCode: 0
	};
	const options = {
		...option,
		params: data
	};

	return handleApi(
		y_common({
			url: '/splcloud/fcgi-bin/gethotkey.fcg',
			method,
			options
		})
	);
}

export async function getSearchByKey({ method = 'get', params = {}, option = {} }: ApiOptions) {
	const data = {
		...params,
		format: 'json',
		outCharset: 'utf-8',
		ct: 24,
		qqmusic_ver: 1298,
		remoteplace: 'txt.yqq.song',
		t: 0,
		aggr: 1,
		cr: 1,
		lossless: 0,
		flag_qc: 0,
		platform: 'yqq.json'
	};
	const options = {
		...option,
		params: data
	};

	return handleApi(
		y_common({
			url: '/soso/fcgi-bin/search_for_qq_cp',
			method,
			options
		})
	);
}

export async function getSmartbox({ method = 'get', params = {}, option = {} }: GetSmartboxOptions) {
	const data = {
		...params,
		format: 'json',
		outCharset: 'utf-8',
		is_xml: 0
	};
	const options: AxiosRequestConfig = {
		...option,
		params: data
	};

	return handleApi(
		y_common({
			url: '/splcloud/fcgi-bin/smartbox_new.fcg',
			method: method as Method,
			options
		})
	);
}
