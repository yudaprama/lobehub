import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

import { kratos } from './sdk';

export function useLogoutLink() {
  const [logoutToken, setLogoutToken] = useState<string>('');
  const router = useRouter();

  useEffect(() => {
    kratos
      .createBrowserLogoutFlow()
      .then(({ data }) => setLogoutToken(data.logout_token))
      .catch(() => {});
  }, []);

  return () => {
    if (!logoutToken) return;
    kratos
      .updateLogoutFlow({ token: logoutToken })
      .then(() => router.push('/signin'))
      .then(() => router.reload());
  };
}
