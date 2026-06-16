import type {
  SettingsFlow,
  UiNode,
  UiNodeInputAttributes,
  UpdateSettingsFlowBody,
} from '@ory/client';

import { kratos } from './sdk';

const KRATOS_PUBLIC_URL =
  process.env.NEXT_PUBLIC_KRATOS_PUBLIC_URL ||
  process.env.KRATOS_PUBLIC_URL ||
  'http://localhost:4433';

/**
 * Change the user's email via Kratos settings flow.
 * Creates a browser settings flow, then submits with the profile method
 * updating the email trait.
 */
export async function changeEmail(args: {
  callbackURL?: string;
  newEmail: string;
}): Promise<{ error?: { message?: string; statusText?: string } } | void> {
  try {
    const { data: flow } = await kratos.createBrowserSettingsFlow({
      returnTo: args.callbackURL,
    });

    const csrfToken = extractCsrfToken(flow);
    const body: UpdateSettingsFlowBody = {
      csrf_token: csrfToken,
      method: 'profile',
      traits: { email: args.newEmail },
    };

    const result = await kratos.updateSettingsFlow({
      flow: flow.id,
      updateSettingsFlowBody: body,
    });

    if (result.data.state === 'success') return;
    const msg = result.data.ui?.messages?.[0];
    if (msg) return { error: { message: msg.text } };
    return;
  } catch (err: any) {
    const msg = err?.response?.data?.ui?.messages?.[0]?.text;
    return { error: { message: msg || err?.message || 'Failed to change email' } };
  }
}

/**
 * Initiate a password reset via Kratos recovery flow.
 * Redirects the browser to the recovery page.
 */
export async function requestPasswordReset(args: {
  email: string;
  redirectTo?: string;
}): Promise<void> {
  const params = new URLSearchParams();
  if (args.redirectTo) params.set('return_to', args.redirectTo);

  const url = `${KRATOS_PUBLIC_URL}/self-service/recovery/browser?${params.toString()}`;
  window.location.href = url;
}

/**
 * Link an OIDC provider to the current account via Kratos settings flow.
 * Redirects the browser to the OIDC provider's authorize URL.
 */
export async function linkOidcProvider(args: {
  callbackURL?: string;
  provider: string;
}): Promise<void> {
  const returnTo = args.callbackURL || '/settings/profile';
  const { data: flow } = await kratos.createBrowserSettingsFlow({ returnTo });

  const body: UpdateSettingsFlowBody = {
    method: 'oidc',
    link: args.provider,
  };

  try {
    await kratos.updateSettingsFlow({
      flow: flow.id,
      updateSettingsFlowBody: body,
    });
  } catch (err: any) {
    // Kratos returns a 422 with redirect URL for browser OIDC flows
    const redirectUrl =
      err?.response?.data?.redirect_browser_to ||
      err?.response?.data?.error?.details?.redirect_browser_to;
    if (redirectUrl) {
      window.location.href = redirectUrl;
      return;
    }
    throw err;
  }
}

/**
 * Unlink an OIDC provider from the current account via Kratos settings flow.
 */
export async function unlinkOidcProvider(args: {
  callbackURL?: string;
  provider: string;
}): Promise<void> {
  const returnTo = args.callbackURL || '/settings/profile';
  const { data: flow } = await kratos.createBrowserSettingsFlow({ returnTo });

  const body: UpdateSettingsFlowBody = {
    method: 'oidc',
    unlink: args.provider,
  };

  await kratos.updateSettingsFlow({
    flow: flow.id,
    updateSettingsFlowBody: body,
  });
}

function extractCsrfToken(flow: SettingsFlow): string {
  const csrfNode = flow.ui?.nodes?.find((n: UiNode) => {
    const attrs = n.attributes as UiNodeInputAttributes;
    return attrs?.name === 'csrf_token';
  });
  return ((csrfNode?.attributes as UiNodeInputAttributes)?.value as string) || '';
}
