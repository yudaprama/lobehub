import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useUserStore } from '@/store/user';

import UserUpdater from './UserUpdater';

const useKratosSessionMock = vi.hoisted(() => vi.fn());

vi.mock('@/libs/kratos/session', () => ({
  useKratosSession: useKratosSessionMock,
}));

const sampleSession = (overrides?: Record<string, unknown>) => ({
  avatar_url: undefined,
  email: 'a@b.com',
  id: 'u1',
  loading: false,
  name: 'Alice',
  username: 'alice',
  ...overrides,
});

describe('UserUpdater', () => {
  beforeEach(() => {
    useKratosSessionMock.mockReset();
    useUserStore.setState({ user: undefined, isSignedIn: false, isLoaded: false });
  });

  afterEach(() => {
    useUserStore.setState({ user: undefined, isSignedIn: false, isLoaded: false });
  });

  it('preserves user fields populated by useInitUserState (e.g. interests) when Kratos re-emits the session on tab focus', () => {
    // Simulate the post-init state: useInitUserState has loaded interests etc.
    useUserStore.setState({
      user: {
        id: 'u1',
        email: 'a@b.com',
        fullName: 'Alice',
        username: 'alice',
        interests: ['内容创作', '编程'],
        firstName: 'A',
        latestName: 'lice',
      },
    });

    useKratosSessionMock.mockReturnValue({
      loading: false,
      session: sampleSession(),
    });
    const { rerender } = render(<UserUpdater />);

    expect(useUserStore.getState().user?.interests).toEqual(['内容创作', '编程']);
    expect(useUserStore.getState().user?.firstName).toBe('A');

    // Simulate Kratos refetching on visibilitychange: same logical user,
    // but session is a fresh object reference.
    useKratosSessionMock.mockReturnValue({
      loading: false,
      session: sampleSession(),
    });
    rerender(<UserUpdater />);

    // Regression: interests / firstName / latestName must NOT be wiped by the
    // session sync.
    expect(useUserStore.getState().user?.interests).toEqual(['内容创作', '编程']);
    expect(useUserStore.getState().user?.firstName).toBe('A');
    expect(useUserStore.getState().user?.latestName).toBe('lice');
  });

  it('drops the previous user profile fields when the session switches to a different account', () => {
    // Simulate user A is signed in with profile fields populated.
    useUserStore.setState({
      user: {
        id: 'userA',
        email: 'a@b.com',
        fullName: 'Alice',
        username: 'alice',
        avatar: 'avatar-a',
        interests: ['内容创作', '编程'],
        firstName: 'A',
        latestName: 'lice',
      },
    });

    // Kratos returns a different account (e.g. another tab signed in as user B).
    useKratosSessionMock.mockReturnValue({
      loading: false,
      session: sampleSession({ id: 'userB', email: 'b@c.com', name: 'Bob', username: 'bob' }),
    });
    render(<UserUpdater />);

    // Profile fields tied to user A must NOT leak to user B's store entry.
    const user = useUserStore.getState().user;
    expect(user?.id).toBe('userB');
    expect(user?.email).toBe('b@c.com');
    expect(user?.interests).toBeUndefined();
    expect(user?.firstName).toBeUndefined();
    expect(user?.latestName).toBeUndefined();
    expect(user?.avatar).toBe('');
  });

  it('clears the user when the session goes away', () => {
    useUserStore.setState({
      user: { id: 'u1', email: 'a@b.com', interests: ['x'] },
    });

    useKratosSessionMock.mockReturnValue({ loading: false, session: null });
    render(<UserUpdater />);

    expect(useUserStore.getState().user).toBeUndefined();
  });
});
