import { beforeEach, describe, expect, it, vi } from 'vitest';

import { checkAuthMethod } from './utils';

describe('checkAuthMethod', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass with valid Kratos session', () => {
    expect(() =>
      checkAuthMethod({
        kratosAuthorized: true,
      }),
    ).not.toThrow();
  });

  it('should throw Unauthorized with no auth params', () => {
    expect(() => checkAuthMethod({})).toThrow();
  });

  it('should throw Unauthorized when kratosAuthorized is false', () => {
    expect(() =>
      checkAuthMethod({
        kratosAuthorized: false,
      }),
    ).toThrow();
  });
});
