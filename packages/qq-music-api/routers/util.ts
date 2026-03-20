import type { KoaContext, Controller } from './types';
import type { ApiResponse, ApiOptions } from '../types/api';
import { errorLog } from '../util/debug';

export interface Validator<T = any> {
  (params: T): { valid: boolean; error?: string };
}

export interface ControllerOptions<T = any> {
  validator?: Validator<T>;
  errorMessage?: string;
  onError?: (ctx: KoaContext, error: unknown) => void;
}

const INTERNAL_ERROR_MESSAGE = 'Internal server error';

const normalizeErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return INTERNAL_ERROR_MESSAGE;
};

const setInternalErrorResponse = (ctx: KoaContext, error: unknown) => {
  errorLog('routers/util', 'Controller error', error);
  ctx.status = 500;
  ctx.body = {
    error: INTERNAL_ERROR_MESSAGE,
  };
};

const isMissingRequiredValue = (value: unknown): boolean => {
  if (value === undefined || value === null) {
    return true;
  }

  if (typeof value === 'string') {
    return value.trim() === '';
  }

  return false;
};

export function createController<T extends ApiOptions>(
  apiFunction: (props: T) => Promise<ApiResponse>,
  options?: ControllerOptions<T>
): Controller {
  return async (ctx: KoaContext) => {
    try {
      const params = {
        ...ctx.query,
        ...ctx.params,
      } as T['params'];

      if (options?.validator) {
        const validation = options.validator(params as T);
        if (!validation.valid) {
          ctx.status = 400;
          ctx.body = {
            response: validation.error || options.errorMessage || 'Invalid parameters',
          };
          return;
        }
      }

      const apiProps = {
        method: 'get',
        params,
        option: {},
      } as T;

      const { status, body } = await apiFunction(apiProps);
      Object.assign(ctx, { status, body });
    } catch (error) {
      if (options?.onError) {
        options.onError(ctx, error);
      } else {
        setInternalErrorResponse(ctx, error);
      }
    }
  };
}

export function createPostController<T extends ApiOptions>(
  apiFunction: (props: T) => Promise<ApiResponse>,
  options?: ControllerOptions<T>
): Controller {
  return async (ctx: KoaContext) => {
    try {
      const params = ctx.request.body || {};

      if (options?.validator) {
        const validation = options.validator(params);
        if (!validation.valid) {
          ctx.status = 400;
          ctx.body = {
            response: validation.error || options.errorMessage || 'Invalid parameters',
          };
          return;
        }
      }

      const apiProps = {
        method: 'post',
        params,
        option: {},
      } as T;

      const { status, body } = await apiFunction(apiProps);
      Object.assign(ctx, { status, body });
    } catch (error) {
      if (options?.onError) {
        options.onError(ctx, error);
      } else {
        setInternalErrorResponse(ctx, error);
      }
    }
  };
}

export function validateRequired(fields: string[]): Validator {
  return (params: Record<string, unknown>) => {
    const missingFields = fields.filter((field) => isMissingRequiredValue(params[field]));

    if (missingFields.length > 0) {
      return {
        valid: false,
        error: `Missing required parameters: ${missingFields.join(', ')}`,
      };
    }

    return { valid: true };
  };
}

export async function handleControllerResponse(
  ctx: KoaContext,
  apiCall: () => Promise<ApiResponse>
): Promise<void> {
  try {
    const { status, body } = await apiCall();
    Object.assign(ctx, { status, body });
  } catch (error) {
    errorLog('routers/util', 'Controller response error', normalizeErrorMessage(error));
    ctx.status = 500;
    ctx.body = { error: INTERNAL_ERROR_MESSAGE };
  }
}

export function createCustomController<T extends ApiOptions>(
  handler: (ctx: KoaContext) => Partial<T>,
  apiFunction: (props: T) => Promise<ApiResponse>
): Controller {
  return async (ctx: KoaContext) => {
    try {
      const customParams = handler(ctx);
      const apiProps = {
        method: 'get',
        option: {},
        ...customParams,
      } as T;

      const { status, body } = await apiFunction(apiProps);
      Object.assign(ctx, { status, body });
    } catch (error) {
      errorLog('routers/util', 'Custom controller error', normalizeErrorMessage(error));
      ctx.status = 500;
      ctx.body = { error: INTERNAL_ERROR_MESSAGE };
    }
  };
}

export const getFirstQueryValue = (value?: string | string[]): string | undefined => {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
};

type ResponseContext = Pick<KoaContext, 'status' | 'body'>;

export const setBadRequest = (ctx: ResponseContext, message: string) => {
  ctx.status = 400;
  ctx.body = {
    response: {
      code: -1,
      msg: message,
      data: null,
    },
  };
};

export const setInternalError = (ctx: ResponseContext, message = INTERNAL_ERROR_MESSAGE) => {
  ctx.status = 500;
  ctx.body = {
    error: message,
  };
};
