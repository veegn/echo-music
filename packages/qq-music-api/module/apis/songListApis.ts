import type { ApiOptions } from '../../types/api';
import { handleApi } from '../../util/apiResponse';
import y_common from './y_common';

export async function songListCategories({ method = 'get', params = {}, option = {} }: ApiOptions) {
	const data = {
		...params,
		format: 'json',
		outCharset: 'utf-8'
	};
	const options = {
		...option,
		params: data
	};

	return handleApi(
		y_common({
			url: '/splcloud/fcgi-bin/fcg_get_diss_tag_conf.fcg',
			method,
			options
		})
	);
}

export async function songListDetail({ method = 'get', params = {}, option = {} }: ApiOptions) {
	const data = {
		...params,
		format: 'json',
		outCharset: 'utf-8',
		type: 1,
		json: 1,
		utf8: 1,
		onlysong: 0,
		new_format: 1
	};
	const options = {
		...option,
		params: data
	};

	return handleApi(
		y_common({
			url: '/qzone/fcg-bin/fcg_ucc_getcdinfo_byids_cp.fcg',
			method,
			options
		})
	);
}

export async function songLists({ method = 'get', params = {}, option = {} }: ApiOptions) {
	const data = {
		...params,
		format: 'json',
		outCharset: 'utf-8',
		picmid: 1
	};
	const options = {
		...option,
		params: data
	};

	return handleApi(
		y_common({
			url: '/splcloud/fcgi-bin/fcg_get_diss_by_tag.fcg',
			method,
			options
		}),
		{
			transformData: (response: unknown) => {
				if (typeof response === 'string') {
					const reg = /^\w+\(([^()]+)\)$/;
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
