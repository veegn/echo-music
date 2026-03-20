export interface ApiResponse {
  status: number;
  body: {
    response?: any;
    error?: any;
    message?: string;
    isOk?: boolean;
    refresh?: boolean;
    data?: any;
    [key: string]: any;
  };
}

export interface ApiOptions {
  method?: string;
  params?: Record<string, any>;
  option?: any;
  isFormat?: boolean | string;
  cookie?: string;
  [key: string]: any;
}

export interface HandleApiOptions<TInput = any, TOutput = any> {
  transformData?: (data: TInput) => TOutput;
  customStatus?: number;
  logError?: boolean;
}

export type ApiFunction<T extends ApiOptions = ApiOptions> = (
  options: T
) => Promise<ApiResponse>;
