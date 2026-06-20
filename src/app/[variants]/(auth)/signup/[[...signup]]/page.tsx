'use client';

import type { RegistrationFlow } from '@ory/client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import Loading from '@/components/Loading/BrandTextLoading';
import { handleFlowError } from '@/libs/kratos/errors';
import { Flow } from '@/libs/kratos/Flow';
import { kratos } from '@/libs/kratos/sdk';

function SignUpContent() {
  const [flow, setFlow] = useState<RegistrationFlow>();
  const router = useRouter();

  useEffect(() => {
    kratos
      .createBrowserRegistrationFlow()
      .then(({ data }) => setFlow(data))
      .catch(handleFlowError(router as any, 'registration', setFlow));
  }, [router]);

  const onSubmit = useCallback(
    async (values: any) => {
      await router.push(`/signup?flow=${flow?.id}`, undefined as any);

      return kratos
        .updateRegistrationFlow({
          flow: String(flow?.id),
          updateRegistrationFlowBody: values,
        })
        .then(() => {
          if (flow?.return_to) {
            window.location.href = flow.return_to;
            return;
          }
          router.push('/');
        })
        .then(() => {})
        .catch(handleFlowError(router as any, 'registration', setFlow))
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
        Create account
      </div>
      <Flow flow={flow} onSubmit={onSubmit} />
      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <Link href="/signin" style={{ color: '#1677ff', fontSize: 14 }}>
          Already have an account? Sign in
        </Link>
      </div>
    </div>
  );
}

const SignUpPage = () => (
  <Suspense fallback={<Loading debugId={'Signup'} />}>
    <SignUpContent />
  </Suspense>
);

export default SignUpPage;
