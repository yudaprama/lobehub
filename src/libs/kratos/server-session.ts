const KRATOS_PUBLIC_URL =
  process.env.KRATOS_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_KRATOS_PUBLIC_URL ||
  'http://localhost:4433';

export interface KratosServerSession {
  user: {
    email: string;
    id: string;
    name: string;
  };
}

export async function getKratosSession(headers: Headers): Promise<KratosServerSession | null> {
  const cookie = headers.get('cookie') || undefined;
  const xSessionToken = headers.get('x-session-token') || undefined;

  const reqHeaders: Record<string, string> = {};
  if (cookie) reqHeaders.cookie = cookie;
  if (xSessionToken) reqHeaders['X-Session-Token'] = xSessionToken;

  if (!cookie && !xSessionToken) return null;

  try {
    const res = await fetch(`${KRATOS_PUBLIC_URL}/sessions/whoami`, {
      headers: reqHeaders,
    });
    if (!res.ok) return null;

    const data = (await res.json()) as {
      identity?: { id?: string; traits?: Record<string, unknown> };
    };
    if (!data?.identity) return null;

    const traits = data.identity.traits ?? {};
    return {
      user: {
        email: (traits.email as string) || '',
        id: data.identity.id || '',
        name: (traits.name as string) || '',
      },
    };
  } catch {
    return null;
  }
}
