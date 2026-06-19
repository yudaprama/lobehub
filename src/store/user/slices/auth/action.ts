import { type SSOProvider } from '@lobechat/types';

import { kratos } from '@/libs/kratos/sdk';
import { type StoreSetter } from '@/store/types';

import { type UserStore } from '../../store';

interface AuthProvidersData {
  hasPasswordAccount: boolean;
  providers: SSOProvider[];
}

const fetchAuthProvidersData = async (): Promise<AuthProvidersData> => {
  try {
    const { data } = await kratos.toSession();
    if (!data?.identity) {
      return { hasPasswordAccount: false, providers: [] };
    }
    return { hasPasswordAccount: true, providers: [] };
  } catch {
    return { hasPasswordAccount: false, providers: [] };
  }
};

type Setter = StoreSetter<UserStore>;
export const createAuthSlice = (set: Setter, get: () => UserStore, _api?: unknown) =>
  new UserAuthActionImpl(set, get, _api);

export class UserAuthActionImpl {
  readonly #get: () => UserStore;
  readonly #set: Setter;

  constructor(set: Setter, get: () => UserStore, _api?: unknown) {
    void _api;
    this.#set = set;
    this.#get = get;
  }

  fetchAuthProviders = async (): Promise<void> => {
    if (this.#get().isLoadedAuthProviders) return;

    try {
      const { hasPasswordAccount, providers } = await fetchAuthProvidersData();
      this.#set({ authProviders: providers, hasPasswordAccount, isLoadedAuthProviders: true });
    } catch (error) {
      console.error('Failed to fetch auth providers:', error);
      this.#set({ isLoadedAuthProviders: true });
    }
  };

  logout = async (): Promise<void> => {
    try {
      await fetch('/oidc/clear-session', { method: 'POST' });
    } catch {
      // best-effort
    }

    try {
      const { data: logoutFlow } = await kratos.createBrowserLogoutFlow();
      await kratos.updateLogoutFlow({ token: logoutFlow.logout_token });
    } catch {
      // fall through to redirect
    }

    window.location.href = '/signin';
  };

  openLogin = async (): Promise<void> => {
    const pathname = location.pathname;
    if (pathname.startsWith('/signin') || pathname.startsWith('/signup')) {
      return;
    }

    const currentUrl = location.toString();
    window.location.href = `/signin?callbackUrl=${encodeURIComponent(currentUrl)}`;
  };

  refreshAuthProviders = async (): Promise<void> => {
    try {
      const { hasPasswordAccount, providers } = await fetchAuthProvidersData();
      this.#set({ authProviders: providers, hasPasswordAccount });
    } catch (error) {
      console.error('Failed to refresh auth providers:', error);
    }
  };
}

export type UserAuthAction = Pick<UserAuthActionImpl, keyof UserAuthActionImpl>;
