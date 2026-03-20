import test from 'node:test';
import assert from 'node:assert/strict';
import type { ApiOptions, ApiResponse } from '../types/api';
import {
  createController,
  getFirstQueryValue,
  handleControllerResponse,
  setBadRequest,
  setInternalError,
  validateRequired,
} from '../routers/util';
import { createEmptyMockContext } from '../routers/context/discoveryControllers';

test('getFirstQueryValue returns first array item or raw value', () => {
  assert.equal(getFirstQueryValue(['a', 'b']), 'a');
  assert.equal(getFirstQueryValue('value'), 'value');
  assert.equal(getFirstQueryValue(undefined), undefined);
});

test('validateRequired reports missing or blank fields', () => {
  const validator = validateRequired(['songmid', 'uin']);

  assert.deepEqual(validator({ songmid: 'abc', uin: '1' }), { valid: true });
  assert.deepEqual(validator({ songmid: ' ', uin: '1' }), {
    valid: false,
    error: 'Missing required parameters: songmid',
  });
  assert.deepEqual(validator({ songmid: 'abc' }), {
    valid: false,
    error: 'Missing required parameters: uin',
  });
});

test('setBadRequest writes normalized 400 payload', () => {
  const ctx = createEmptyMockContext();

  setBadRequest(ctx, 'missing songmid');

  assert.equal(ctx.status, 400);
  assert.deepEqual(ctx.body, {
    response: {
      code: -1,
      msg: 'missing songmid',
      data: null,
    },
  });
});

test('setInternalError writes normalized 500 payload', () => {
  const ctx = createEmptyMockContext();

  setInternalError(ctx, 'boom');

  assert.equal(ctx.status, 500);
  assert.deepEqual(ctx.body, {
    error: 'boom',
  });
});

test('createController returns validation errors before calling api function', async () => {
  let called = false;
  const controller = createController<ApiOptions>(
    async (): Promise<ApiResponse> => {
      called = true;
      return {
        status: 200,
        body: {
          response: { ok: true },
        },
      };
    },
    {
      validator: validateRequired(['songmid']),
    }
  );

  const ctx = createEmptyMockContext();
  await controller(ctx, async () => {});

  assert.equal(called, false);
  assert.equal(ctx.status, 400);
  assert.deepEqual(ctx.body, {
    response: 'Missing required parameters: songmid',
  });
});

test('createController forwards api response on success', async () => {
  const controller = createController<ApiOptions>(async (props): Promise<ApiResponse> => {
    return {
      status: 200,
      body: {
        response: {
          echoedParams: props.params,
        },
      },
    };
  });

  const ctx = createEmptyMockContext();
  ctx.query = { songmid: '003' };
  ctx.params = { id: '42' };

  await controller(ctx, async () => {});

  assert.equal(ctx.status, 200);
  assert.deepEqual(ctx.body, {
    response: {
      echoedParams: {
        songmid: '003',
        id: '42',
      },
    },
  });
});

test('handleControllerResponse maps api results onto context', async () => {
  const ctx = createEmptyMockContext();

  await handleControllerResponse(ctx, async () => ({
    status: 206,
    body: {
      response: {
        ok: true,
      },
    },
  }));

  assert.equal(ctx.status, 206);
  assert.deepEqual(ctx.body, {
    response: {
      ok: true,
    },
  });
});
