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

  it('throws when Kratos session is missing', async () => {
    // Reset module state for a clean test
    vi.resetModules();
    vi.doMock('@/envs/file', () => ({
      fileEnv: {
        NEXT_PUBLIC_PREST_URL: undefined,
        NEXT_PUBLIC_KRATOS_PUBLIC_URL: undefined,
      },
    }));
    const { getPrestClient: getPrestClientFresh } = await import('./client');
    prestFactoryMock.mockClear();

    // With big-bang getPrestClient always uses DEFAULT_PREST_URL if env is
    // unset, but fromKratosSession returns null if no Kratos cookie exists
    // (simulated by the hoisted mock returning null).
    prestFactoryMock.mockResolvedValue(null);

    await expect(getPrestClientFresh()).rejects.toThrow('No Kratos session');

    vi.doUnmock('@/envs/file');
    vi.resetModules();
  });
});
