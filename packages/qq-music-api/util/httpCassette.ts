import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { AxiosRequestConfig, AxiosResponse } from 'axios';

type HttpMode = 'live' | 'record' | 'replay';

type CassettePayload = {
  request: {
    method: string;
    url: string;
    params?: unknown;
    data?: unknown;
    headers?: Record<string, unknown>;
  };
  response: {
    status: number;
    statusText: string;
    headers: Record<string, unknown>;
    data: unknown;
  };
};

const VOLATILE_HEADER_KEYS = new Set([
  'authorization',
  'cookie',
  'cookies',
  'user-agent',
  'referer',
  'host',
  'content-length',
]);

const VOLATILE_PARAM_KEYS = new Set([
  '_',
  'pcachetime',
  'r',
  'rnd',
  'sign',
  'g_tk',
  'g_tk_new_20200303',
  'uin',
  'loginuin',
]);

function sortValue(value: any): any {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, any>>((acc, key) => {
        if (!VOLATILE_PARAM_KEYS.has(key.toLowerCase())) {
          acc[key] = sortValue(value[key]);
        }
        return acc;
      }, {});
  }
  return value;
}

function parseJsonLike(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return trimmed;
  }

  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  return trimmed;
}

function normalizeHeaders(headers: AxiosRequestConfig['headers']): Record<string, unknown> {
  if (!headers || typeof headers !== 'object') {
    return {};
  }

  const input = headers as Record<string, unknown>;
  return Object.keys(input)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      if (!VOLATILE_HEADER_KEYS.has(key.toLowerCase())) {
        acc[key] = sortValue(parseJsonLike(input[key]));
      }
      return acc;
    }, {});
}

function buildCassetteKey(config: AxiosRequestConfig): string {
  const signature = {
    method: String(config.method || 'get').toLowerCase(),
    url: config.url || '',
    params: sortValue(parseJsonLike(config.params)),
    data: sortValue(parseJsonLike(config.data)),
  };

  return crypto
    .createHash('sha1')
    .update(JSON.stringify(signature))
    .digest('hex');
}

export function getHttpMode(): HttpMode {
  const mode = String(process.env.QQMUSIC_API_HTTP_MODE || 'live').toLowerCase();
  if (mode === 'record' || mode === 'replay') {
    return mode;
  }
  return 'live';
}

export function getCassetteDir(): string {
  return process.env.QQMUSIC_API_HTTP_FIXTURE_DIR
    ? path.resolve(process.env.QQMUSIC_API_HTTP_FIXTURE_DIR)
    : path.resolve(__dirname, '..', 'tests', 'cassettes');
}

function ensureCassetteDir(): string {
  const dir = getCassetteDir();
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function getCassetteFilePath(config: AxiosRequestConfig): string {
  return path.join(ensureCassetteDir(), `${buildCassetteKey(config)}.json`);
}

export function loadCassette<T = any>(config: AxiosRequestConfig): AxiosResponse<T> {
  const filePath = getCassetteFilePath(config);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Cassette not found for ${String(config.method || 'get').toUpperCase()} ${config.url}: ${filePath}`);
  }

  const cassette = JSON.parse(fs.readFileSync(filePath, 'utf8')) as CassettePayload;
  return {
    data: cassette.response.data as T,
    status: cassette.response.status,
    statusText: cassette.response.statusText,
    headers: cassette.response.headers as any,
    config: {
      ...(config as any),
      headers: (config.headers || {}) as any,
    } as any,
    request: undefined,
  };
}

export function saveCassette<T = any>(config: AxiosRequestConfig, response: AxiosResponse<T>): void {
  const filePath = getCassetteFilePath(config);
  const payload: CassettePayload = {
    request: {
      method: String(config.method || 'get').toLowerCase(),
      url: config.url || '',
      params: sortValue(parseJsonLike(config.params)),
      data: sortValue(parseJsonLike(config.data)),
      headers: normalizeHeaders(config.headers),
    },
    response: {
      status: response.status,
      statusText: response.statusText,
      headers: sortValue(response.headers || {}),
      data: sortValue(response.data),
    },
  };

  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
}
