import axios, { AxiosRequestConfig, AxiosResponse, Method } from 'axios';
import http from 'http';
import https from 'https';
import colors from './colors';
import { debugLog, errorLog, isDebugEnabled } from './debug';
import { getHttpMode, loadCassette, saveCassette } from './httpCassette';

const MAX_ERROR_BODY_LENGTH = 300;

const summarizeErrorResponse = (data: unknown): unknown => {
	if (data === undefined || data === null || data === '') {
		return data ?? null;
	}

	if (typeof data === 'string') {
		return data.slice(0, MAX_ERROR_BODY_LENGTH);
	}

	try {
		return JSON.parse(JSON.stringify(data));
	} catch {
		return String(data).slice(0, MAX_ERROR_BODY_LENGTH);
	}
};

// Create dedicated instance
const service = axios.create({
	withCredentials: true,
	timeout: 15000,
	responseType: 'json',
	// Enable keep-alive for better performance
	httpAgent: new http.Agent({ keepAlive: true }),
	httpsAgent: new https.Agent({ keepAlive: true })
});

const ensureContentType = (config: AxiosRequestConfig) => {
	const method = (config.method || 'get').toLowerCase();
	const hasBody = config.data !== undefined && config.data !== null;
	const headers = config.headers || {};
	const hasContentType = Boolean((headers as any)['Content-Type'] || (headers as any)['content-type']);

	if (hasBody && !hasContentType && ['post', 'put', 'patch', 'delete'].includes(method)) {
		(headers as any)['Content-Type'] = 'application/x-www-form-urlencoded; charset=UTF-8';
	}

	config.headers = headers;
};

// Request interceptor to ensure headers
service.interceptors.request.use(
	config => {
		// Ensure User-Agent
		if (config.headers && !config.headers['User-Agent']) {
			config.headers['User-Agent'] =
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
		}

		ensureContentType(config);
		return config;
	},
	error => {
		return Promise.reject(error);
	}
);

// Response interceptor
service.interceptors.response.use(
	response => {
		if (!response) {
			throw Error('response is null');
		}
		if (isDebugEnabled()) {
			debugLog('request', colors.info(`${response.config.url} request success`));
		}
		return response;
	},
	error => {
		const url = error.config ? error.config.url : 'Unknown URL';
		errorLog('request', colors.error(`${url} request error: ${error.message}`), {
			method: error.config?.method,
			status: error.response?.status,
			statusText: error.response?.statusText,
			params: error.config?.params,
			data: summarizeErrorResponse(error.response?.data)
		});
		return Promise.reject(error);
	}
);

const yURL = 'https://y.qq.com';
const cURL = 'https://c.y.qq.com';

export type RequestBaseUrl = 'c' | 'y' | 'u';

export interface RequestConfig<TOptions extends AxiosRequestConfig = AxiosRequestConfig> {
	url?: string;
	method?: Method | Lowercase<Method>;
	options?: TOptions;
	isUUrl?: RequestBaseUrl;
	headers?: Record<string, string>;
}

function request<TResponse = any, TOptions extends AxiosRequestConfig = AxiosRequestConfig>(
	configOrUrl: string | RequestConfig<TOptions>,
	method?: Method | Lowercase<Method>,
	options?: TOptions,
	isUUrl: RequestBaseUrl = 'c'
): Promise<AxiosResponse<TResponse>> {
	let url: string;
	let reqMethod: Method | Lowercase<Method>;
	let reqOptions: TOptions | undefined;
	let reqIsUUrl: RequestBaseUrl;

	if (typeof configOrUrl === 'object') {
		url = configOrUrl.url || '';
		reqMethod = configOrUrl.method || 'GET';
		reqOptions = configOrUrl.options;
		reqIsUUrl = configOrUrl.isUUrl || 'c';
	} else {
		url = configOrUrl;
		reqMethod = method || 'GET';
		reqOptions = options;
		reqIsUUrl = isUUrl;
	}

	let baseURL = '';
	switch (reqIsUUrl) {
	case 'y':
		baseURL = yURL + url;
		break;
	case 'u':
		baseURL = url;
		break;
	case 'c':
		baseURL = cURL + url;
		break;
	default:
		baseURL = cURL + url;
		break;
	}

	const config: AxiosRequestConfig = {
		...(reqOptions || {}),
		url: baseURL,
		method: reqMethod.toLowerCase() as Method
	};

	const headers = config.headers || {};
	if ((headers as any).cookies) {
		if (!(headers as any).Cookie) {
			(headers as any).Cookie = (headers as any).cookies;
		}
		delete (headers as any).cookies;
	}

  // Use the explicitly provided cookie via options
	if (!(headers as any).Cookie && !(headers as any).cookie) {
    if ((reqOptions as any)?.cookie) {
      (headers as any).Cookie = (reqOptions as any).cookie;
    }
	}

	config.headers = headers;
  const mode = getHttpMode();
  if (mode === 'replay') {
    return Promise.resolve(loadCassette<TResponse>(config));
  }

  if (mode === 'record') {
    return service<TResponse>(config).then((response) => {
      saveCassette(config, response);
      return response;
    });
  }

	return service<TResponse>(config);
}

export default request;
