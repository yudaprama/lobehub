import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { mutate } from '@/libs/swr';
import { useUserStore } from '@/store/user';

vi.mock('zustand/traditional');

// Mock @/libs/swr mutate
vi.mock('@/libs/swr', async () => {
  const actual = await vi.importActual('@/libs/swr');
  return {
    ...actual,
    mutate: vi.fn(),
  };
});

const mockKratos = vi.hoisted(() => ({
  createBrowserLogoutFlow: vi.fn(),
  toSession: vi.fn(),
  updateLogoutFlow: vi.fn(),
}));

const mockFetch = vi.hoisted(() => vi.fn().mockResolvedValue({ ok: true }));

vi.mock('@/libs/kratos/sdk', () => ({
  kratos: mockKratos,
}));

vi.stubGlobal('fetch', mockFetch);

afterEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();

  // Reset store state
  useUserStore.setState({
    isLoadedAuthProviders: false,
    authProviders: [],
    hasPasswordAccount: false,
  });
});

beforeEach(() => {
  mockKratos.createBrowserLogoutFlow.mockResolvedValue({
    data: { logout_token: 'test-token' },
  });
  mockKratos.toSession.mockResolvedValue({
    data: {
      identity: {
        id: 'kratos-user-1',
        traits: { email: 'test@test.com', name: 'Test' },
      },
    },
  });
  mockKratos.updateLogoutFlow.mockResolvedValue({ data: undefined });
});

describe('createAuthSlice', () => {
  describe('refreshUserState', () => {
    it('should refresh user config', async () => {
      const { result } = renderHook(() => useUserStore());

      await act(async () => {
        await result.current.refreshUserState();
      });

      expect(mutate).toHaveBeenCalledWith('initUserState');
    });
  });

  describe('logout', () => {
    it('should call Kratos logout flow', async () => {
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
          ...originalLocation,
          href: '',
        },
        writable: true,
      });

      const store = useUserStore.getState();

      await store.logout();

      expect(mockKratos.createBrowserLogoutFlow).toHaveBeenCalled();
      expect(mockKratos.updateLogoutFlow).toHaveBeenCalledWith({ token: 'test-token' });
      expect(window.location.href).toBe('/signin');

      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
        writable: true,
      });
    });
  });

  describe('openLogin', () => {
    it('should redirect to signin page', async () => {
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
          ...originalLocation,
          href: '',
          pathname: '/chat',
          toString: () => 'http://localhost/chat',
        },
        writable: true,
      });

      const { result } = renderHook(() => useUserStore());

      await act(async () => {
        await result.current.openLogin();
      });

      expect(window.location.href).toContain('/signin');
      expect(window.location.href).toContain('callbackUrl');

      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
        writable: true,
      });
    });

    it('should not redirect when already on signin page', async () => {
      const originalLocation = window.location;
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
          ...originalLocation,
          href: '',
          pathname: '/signin',
          toString: () => 'http://localhost/signin',
        },
        writable: true,
      });

      const { result } = renderHook(() => useUserStore());

      await act(async () => {
        await result.current.openLogin();
      });

      expect(window.location.href).toBe('');

      Object.defineProperty(window, 'location', {
        configurable: true,
        value: originalLocation,
        writable: true,
      });
    });
  });

  describe('fetchAuthProviders', () => {
    it('should skip fetching if already loaded', async () => {
      useUserStore.setState({ isLoadedAuthProviders: true });

      const { result } = renderHook(() => useUserStore());

      await act(async () => {
        await result.current.fetchAuthProviders();
      });

      expect(mockKratos.toSession).not.toHaveBeenCalled();
    });

    it('should fetch providers from Kratos', async () => {
      const { result } = renderHook(() => useUserStore());

      await act(async () => {
        await result.current.fetchAuthProviders();
      });

      expect(mockKratos.toSession).toHaveBeenCalled();
      expect(result.current.isLoadedAuthProviders).toBe(true);
    });

    it('should handle fetch error gracefully', async () => {
      mockKratos.toSession.mockRejectedValueOnce(new Error('Network error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useUserStore());

      await act(async () => {
        await result.current.fetchAuthProviders();
      });

      expect(result.current.isLoadedAuthProviders).toBe(true);
      consoleSpy.mockRestore();
    });
  });

  describe('refreshAuthProviders', () => {
    it('should refresh providers from Kratos', async () => {
      const { result } = renderHook(() => useUserStore());

      await act(async () => {
        await result.current.refreshAuthProviders();
      });

      expect(mockKratos.toSession).toHaveBeenCalled();
    });

    it('should handle refresh error gracefully', async () => {
      mockKratos.toSession.mockRejectedValueOnce(new Error('Refresh failed'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useUserStore());

      await act(async () => {
        await result.current.refreshAuthProviders();
      });

      // Should not throw
      consoleSpy.mockRestore();
    });
  });
});
