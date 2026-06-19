import { type LobeChatDatabase } from '@lobechat/database';
import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { UserModel } from '@/database/models/user';
import { type UserItem } from '@/database/schemas';
import { users } from '@/database/schemas';

export class WebhookUserService {
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  /**
   * Find user by Kratos identity ID.
   * With Kratos, the user's `id` field stores the Kratos identity ID
   * and OIDC account linking is handled by Kratos itself.
   */
  private getUserByIdentity = async (identityId: string) => {
    return this.db.query.users.findFirst({
      where: eq(users.id, identityId),
    });
  };

  /**
   * Safely update user data from webhook
   */
  safeUpdateUser = async (
    { accountId, providerId }: { accountId: string; providerId: string },
    data: Partial<UserItem>,
  ) => {
    console.info(`updating user "${JSON.stringify({ accountId, providerId })}" due to webhook`);

    const user = await this.getUserByIdentity(accountId);

    if (user?.id) {
      const userModel = new UserModel(this.db, user.id);
      await userModel.updateUser({
        avatar: data?.avatar,
        email: data?.email,
        fullName: data?.fullName,
      });
    } else {
      console.warn(
        `[${providerId}]: Webhook user "${JSON.stringify({ accountId, providerId })}" update for "${JSON.stringify(data)}", but no user was found.`,
      );
    }

    return NextResponse.json({ message: 'user updated', success: true }, { status: 200 });
  };

  /**
   * Safely sign out user (sessions are managed by Kratos)
   */
  safeSignOutUser = async ({
    accountId,
    providerId,
  }: {
    accountId: string;
    providerId: string;
  }) => {
    console.info(`Signing out user "${JSON.stringify({ accountId, providerId })}"`);

    const user = await this.getUserByIdentity(accountId);

    if (user?.id) {
      console.info(`[${providerId}]: requested signout for identity_id=${user.id}`);
    } else {
      console.warn(
        `[${providerId}]: Webhook user "${JSON.stringify({ accountId, providerId })}" signout, but no user was found.`,
      );
    }

    return NextResponse.json({ message: 'user signed out', success: true }, { status: 200 });
  };
}
