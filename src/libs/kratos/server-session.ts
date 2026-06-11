// Server-side Kratos session validation.
// For use in Next.js API routes and middleware (server-side only).
// Calls Kratos public API with the request's cookie to validate the session.

const KRATOS_PUBLIC_URL =
  process.env.KRATOS_PUBLIC_URL ||
  process.env.NEXT_PUBLIC_KRATOS_PUBLIC_URL ||
  'http://localhost:4433';

export interface KratosServerSession {
  id: string;
  identity: {
    id: string;
    traits: {
      email?: string;
      name?: string;
      username?: string;
    };
  };
}

export async function getKratosSession(
  headers: Headers | Record<string, string>,
): Promise<KratosServerSession | null> {
  const cookie =
    typeof headers.get === 'function'
      ? (headers as Headers).get('cookie')
      : (headers as Record<string, string>)['cookie'];

  if (!cookie) return null;

  try {
    const res = await fetch(`${KRATOS_PUBLIC_URL}/sessions/whoami`, {
      headers: { cookie },
    });

    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
