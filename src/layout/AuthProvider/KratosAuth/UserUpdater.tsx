'use client';

import { memo, useEffect } from 'react';
import { createStoreUpdater } from 'zustand-utils';

import { useKratosSession } from '@/libs/kratos/session';
import { useUserStore } from '@/store/user';
import { type LobeUser } from '@/types/user';

const UserUpdater = memo(() => {
  const { session, loading } = useKratosSession();

  const isLoaded = !loading;
  const isSignedIn = !!session;

  const useStoreUpdater = createStoreUpdater(useUserStore);

  useStoreUpdater('isLoaded', isLoaded);
  useStoreUpdater('isSignedIn', isSignedIn);

  useEffect(() => {
    if (session) {
      useUserStore.setState((state) => {
        const baseUser = state.user?.id === session.id ? state.user : undefined;
        return {
          user: {
            ...baseUser,
            avatar: baseUser?.avatar || session.avatar_url || '',
            email: session.email,
            fullName: session.name,
            id: session.id,
            username: session.username,
          } as LobeUser,
        };
      });
      return;
    }

    useUserStore.setState({ user: undefined });
  }, [session]);

  return null;
});

export default UserUpdater;
