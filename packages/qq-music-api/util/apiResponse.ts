import type { ApiResponse } from '../types/api';
import { errorLog } from './debug';

export function successResponse(data: any, status: number = 200): ApiResponse {
  return {
    status,
    body: {
      response: data,
    },
  };
}

export function errorResponse(error: any, status: number = 500): ApiResponse {
  return {
    status,
    body: {
      error,
    },
  };
}

export async function handleApi<T = any>(
  promise: Promise<T>,
  options?: {
    transformData?: (data: T) => any;
    customStatus?: number;
    logError?: boolean;
  }
): Promise<ApiResponse> {
  try {
    const result = await promise;
    const resultAny = result as any;
    const responseData = options?.transformData
      ? options.transformData(resultAny.data || result)
      : resultAny.data || result;

    return {
      status: options?.customStatus || 200,
      body: {
        response: responseData,
      },
    };
  } catch (error) {
    if (options?.logError !== false && process.env.NODE_ENV !== 'test') {
      errorLog('apiResponse', 'API error', error);
    }

    return {
      status: options?.customStatus || 500,
      body: {
        error,
      },
    };
  }
}

export function customResponse(body: any, status: number = 200): ApiResponse {
  return {
    status,
    body,
  };
}

export function badRequest(message: string): ApiResponse {
  return {
    status: 400,
    body: {
      response: message,
    },
  };
}
