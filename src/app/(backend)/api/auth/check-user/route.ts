import { eq } from 'drizzle-orm';
import { type NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { users } from '@/database/schemas/user';
import { serverDB } from '@/database/server';

export interface CheckUserResponseData {
  exists: boolean;
  hasPassword?: boolean;
}

/**
 * Check if a user exists by email.
 * With Kratos, the existence check is sufficient for the UI flow; the
 * password presence flag is no longer derived from the Better Auth accounts
 * table because credentials are managed by Kratos.
 * @param req - POST request with { email: string }
 * @returns { exists: boolean, hasPassword?: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email is required', exists: false }, { status: 400 });
    }

    // Query database for user with this email
    const [user] = await serverDB
      .select({
        emailVerified: users.emailVerified,
        id: users.id,
      })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      return NextResponse.json({ exists: false });
    }

    return NextResponse.json({
      exists: true,
    } satisfies CheckUserResponseData);
  } catch (error) {
    console.error('Error checking user existence:', error);
    return NextResponse.json({ error: 'Internal server error', exists: false }, { status: 500 });
  }
}
