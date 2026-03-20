import type { Controller } from '../types';
import { getMvByTag } from '../../module';

export const mvByTagController: Controller = async (ctx) => {
  const props = {
    method: 'get',
    params: {},
    option: {}
  };

  const { status, body } = await getMvByTag(props);
  Object.assign(ctx, {
    status,
    body
  });
};
