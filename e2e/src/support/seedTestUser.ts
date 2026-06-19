// Test user credentials - these are used for e2e testing only
export const TEST_USER = {
  email: 'e2e-test@lobehub.com',
  fullName: 'E2E Test User',
  id: 'user_e2e_test_user_001',
  password: 'TestPassword123!',
  username: 'e2e_test_user',
};

/**
 * Seed test user into the database for e2e testing.
 * With Kratos, the user identity is managed by Kratos itself.
 * This function only seeds the LobeHub users table row so the
 * app can find the user by email.  Credentials live in Kratos.
 */
export async function seedTestUser(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.log('⚠️ DATABASE_URL not set, skipping test user seeding');
    return;
  }

  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: databaseUrl });

  try {
    await client.connect();
    console.log('🔌 Connected to database for test user seeding');

    const now = new Date().toISOString();
    const onboarding = JSON.stringify({ finishedAt: now, version: 1 });

    await client.query(
      `INSERT INTO users (id, email, normalized_email, username, full_name, email_verified, onboarding, created_at, updated_at, last_active_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $8)
       ON CONFLICT (id) DO UPDATE SET onboarding = $7, updated_at = $8`,
      [
        TEST_USER.id,
        TEST_USER.email,
        TEST_USER.email.toLowerCase(),
        TEST_USER.username,
        TEST_USER.fullName,
        true,
        onboarding,
        now,
      ],
    );

    console.log('✅ Test user seeded successfully');
    console.log(`   Email: ${TEST_USER.email}`);
    console.log(`   Password: ${TEST_USER.password}`);
  } catch (error) {
    console.error('❌ Failed to seed test user:', error);
    throw error;
  } finally {
    await client.end();
  }
}

/**
 * Clean up test user data after tests.
 * With Kratos, sessions and credentials are managed by Kratos, so we
 * only delete the LobeHub users row here.
 */
export async function cleanupTestUser(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    return;
  }

  const { default: pg } = await import('pg');
  const client = new pg.Client({ connectionString: databaseUrl });

  try {
    await client.connect();

    await client.query('DELETE FROM users WHERE id = $1', [TEST_USER.id]);

    console.log('🧹 Test user cleaned up');
  } catch (error) {
    console.error('❌ Failed to cleanup test user:', error);
  } finally {
    await client.end();
  }
}
