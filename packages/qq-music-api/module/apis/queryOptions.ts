import type { ApiOptions } from '../../types/api';

export function buildQueryOptions(
  params: ApiOptions['params'] = {},
  option: ApiOptions['option'] = {},
  defaults: Record<string, any> = {}
) {
  return {
    ...(option || {}),
    params: {
      ...(params || {}),
      ...defaults,
    },
  };
}
