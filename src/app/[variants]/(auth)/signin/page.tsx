'use client';

import type { LoginFlow } from '@ory/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import Loading from '@/components/Loading/BrandTextLoading';
import { handleFlowError } from '@/libs/kratos/errors';
import { Flow } from '@/libs/kratos/Flow';
import { kratos } from '@/libs/kratos/sdk';

function SignInContent() {
  const [flow, setFlow] = useState<LoginFlow>();
  const router = useRouter();

  useEffect(() => {
    kratos
      .createBrowserLoginFlow()
      .then(({ data }) => setFlow(data))
      .catch(handleFlowError(router as any, 'login', setFlow));
  }, [router]);

  const onSubmit = useCallback(
    async (values: any) => {
      await router.push(`/signin?flow=${flow?.id}`, undefined as any);

      return kratos
        .updateLoginFlow({
          flow: String(flow?.id),
          updateLoginFlowBody: values,
        })
        .then(() => {
          if (flow?.return_to) {
            window.location.href = flow.return_to;
            return;
          }
          router.push('/');
        })
        .then(() => {})
        .catch(handleFlowError(router as any, 'login', setFlow))
        .catch(async (err: any) => {
          if (err.response?.status === 400) {
            setFlow(err.response?.data);
            return;
          }
          throw err;
        });
    },
    [flow, router],
  );

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', padding: '0 16px' }}>
      <div style={{ marginBottom: 24, textAlign: 'center', fontSize: 24, fontWeight: 600 }}>
        Sign in
      </div>
      <Flow flow={flow} onSubmit={onSubmit} />
      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <Link href="/signup" style={{ color: '#1677ff', fontSize: 14 }}>
          Create account
        </Link>
      </div>
    </div>
  );
}

const SignInPage = () => (
  <Suspense fallback={<Loading debugId={'Signin'} />}>
    <SignInContent />
  </Suspense>
);

export default SignInPage;
