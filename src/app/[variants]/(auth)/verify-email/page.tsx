'use client';

import type { VerificationFlow } from '@ory/client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { handleFlowError } from '@/libs/kratos/errors';
import { Flow } from '@/libs/kratos/Flow';
import { kratos } from '@/libs/kratos/sdk';

const VerificationPage = () => {
  const [flow, setFlow] = useState<VerificationFlow>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const flowId = searchParams.get('flow');

  useEffect(() => {
    if (flowId) {
      kratos
        .getVerificationFlow({ id: flowId })
        .then(({ data }) => setFlow(data))
        .catch(handleFlowError(router as any, 'verification', setFlow));
      return;
    }

    kratos
      .createBrowserVerificationFlow()
      .then(({ data }) => setFlow(data))
      .catch(handleFlowError(router as any, 'verification', setFlow));
  }, [flowId, router]);

  const onSubmit = useCallback(
    async (values: any) => {
      await router.push(`/verify-email?flow=${flow?.id}`, undefined as any);

      return kratos
        .updateVerificationFlow({
          flow: String(flow?.id),
          updateVerificationFlowBody: values,
        })
        .then(() => {
          if (flow?.return_to) {
            window.location.href = flow.return_to;
          }
        })
        .then(() => {})
        .catch(handleFlowError(router as any, 'verification', setFlow))
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
      <div style={{ marginBottom: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 8 }}>Verify email</div>
        <div style={{ fontSize: 14, color: '#666' }}>
          Enter your email to receive a verification code
        </div>
      </div>
      <Flow flow={flow} onSubmit={onSubmit} />
      <div style={{ textAlign: 'center', marginTop: 12 }}>
        <Link href="/signin" style={{ color: '#1677ff', fontSize: 14 }}>
          Back to sign in
        </Link>
      </div>
    </div>
  );
};

export default VerificationPage;
