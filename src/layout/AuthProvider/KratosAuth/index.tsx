import { type PropsWithChildren } from 'react';

import UserUpdater from './UserUpdater';

const KratosAuth = ({ children }: PropsWithChildren) => {
  return (
    <>
      {children}
      <UserUpdater />
    </>
  );
};

export default KratosAuth;
