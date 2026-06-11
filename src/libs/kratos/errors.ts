import type { AxiosError } from 'axios';
import type { Router } from 'next/router';
import type { Dispatch, SetStateAction } from 'react';

type FlowErrorResponse = {
  error?: { id?: string };
  redirect_browser_to?: string;
};

type FlowType = 'login' | 'registration' | 'settings' | 'recovery' | 'verification';

function getFlowPath(flowType: FlowType): string {
  switch (flowType) {
    case 'login': {
      return '/signin';
    }
    case 'registration': {
      return '/signup';
    }
    case 'recovery': {
      return '/recovery';
    }
    case 'verification': {
      return '/verify-email';
    }
    case 'settings': {
      return '/settings';
    }
  }
}

export function handleFlowError<S>(
  router: Router,
  flowType: FlowType,
  resetFlow: Dispatch<SetStateAction<S | undefined>>,
) {
  return async (err: AxiosError<FlowErrorResponse>) => {
    const data = err.response?.data;

    switch (data?.error?.id) {
      case 'session_inactive': {
        await router.push(`/signin?return_to=${encodeURIComponent(window.location.href)}`);
        return;
      }
      case 'session_aal2_required': {
        if (data.redirect_browser_to) {
          window.location.href = data.redirect_browser_to;
          return;
        }
        await router.push(`/signin?aal=aal2&return_to=${encodeURIComponent(window.location.href)}`);
        return;
      }
      case 'session_already_available': {
        await router.push('/');
        return;
      }
      case 'session_refresh_required': {
        if (data.redirect_browser_to) {
          window.location.href = data.redirect_browser_to;
        }
        return;
      }
      case 'self_service_flow_expired': {
        resetFlow(undefined);
        await router.push(getFlowPath(flowType));
        return;
      }
      case 'security_csrf_violation':
      case 'security_identity_mismatch': {
        resetFlow(undefined);
        await router.push(getFlowPath(flowType));
        return;
      }
      case 'browser_location_change_required': {
        if (data.redirect_browser_to) {
          window.location.href = data.redirect_browser_to;
        }
        return;
      }
    }

    if (err.response?.status === 410) {
      resetFlow(undefined);
      await router.push(getFlowPath(flowType));
      return;
    }

    throw err;
  };
}
