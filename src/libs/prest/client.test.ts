import { describe, expect, it, vi } from 'vitest';

import { getPrestClient } from './client';

vi.mock('@/envs/file', () => ({
  fileEnv: {
    NEXT_PUBLIC_PREST_URL: 'http://localhost:3000',
    NEXT_PUBLIC_KRATOS_PUBLIC_URL: 'http://localhost:4433',
  },
}));

const prestFactoryMock = vi.hoisted(() => vi.fn());

vi.mock('prest-js-sdk', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    PrestClient: {
      ...((actual.PrestClient ?? {}) as Record<string, unknown>),
      fromKratosSession: (...args: unknown[]) => prestFactoryMock(...args),
    },
  };
});

describe('getPrestClient', () => {
  it('caches the client across calls', async () => {
    prestFactoryMock.mockResolvedValue({ tag: 'client-1' });

    const a = await getPrestClient();
    const b = await getPrestClient();

    expect(a).toBe(b);
    expect(prestFactoryMock).toHaveBeenCalledTimes(1);
    expect(prestFactoryMock).toHaveBeenCalledWith('http://localhost:4433', 'http://localhost:3000');
  });

  it('returns null when NEXT_PUBLIC_PREST_URL is unset', async () => {
    vi.resetModules();
    vi.doMock('@/envs/file', () => ({
      fileEnv: {
        NEXT_PUBLIC_PREST_URL: undefined,
        NEXT_PUBLIC_KRATOS_PUBLIC_URL: undefined,
      },
    }));
    const { getPrestClient: getPrestClientFresh } = await import('./client');
    prestFactoryMock.mockClear();

    const result = await getPrestClientFresh();

    expect(result).toBeNull();
    expect(prestFactoryMock).not.toHaveBeenCalled();

    vi.doUnmock('@/envs/file');
    vi.resetModules();
  });
});
