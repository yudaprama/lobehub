import { isDesktop } from '@lobechat/const';
import { type PropsWithChildren } from 'react';

import Desktop from './Desktop';
import KratosAuth from './KratosAuth';

const AuthProvider = ({ children }: PropsWithChildren) => {
  if (isDesktop) {
    return <Desktop>{children}</Desktop>;
  }

  // In SPA/Vite mode, always use KratosAuth.
  // If auth is not configured on the server, useSession() will return no session
  // and the user will be treated as not signed in — same effect as NoAuth.
  return <KratosAuth>{children}</KratosAuth>;
};

export default AuthProvider;
