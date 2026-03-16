import type { ApiResponse, ApiOptions } from '../types/api';

export interface KoaContext {
  query: Record<string, string | string[]>;
  params: Record<string, string>;
  request: {
    body?: any;
    rawBody?: string;
  };
  body: any;
  status: number;
}

export type { ApiOptions };
export type { ApiResponse };

export type Controller = (ctx: KoaContext, next: () => Promise<void>) => Promise<void>;
