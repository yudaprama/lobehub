-- Drop legacy Better Auth and NextAuth tables
-- Run AFTER deploying the Kratos migration code to production
-- These tables are no longer used once Better Auth is fully replaced by Ory Kratos
--
-- Tables being dropped:
--   1. auth_sessions          — Better Auth session storage
--   2. accounts               — Better Auth OAuth/password accounts
--   3. verifications          — Better Auth email verification tokens
--   4. two_factor             — Better Auth TOTP two-factor secrets
--   5. passkey                — Better Auth WebAuthn passkeys
--   6. nextauth_accounts      — Legacy NextAuth OAuth accounts
--   7. nextauth_sessions      — Legacy NextAuth sessions
--   8. nextauth_verificationtokens — Legacy NextAuth verification tokens
--   9. nextauth_authenticators — Legacy NextAuth WebAuthn authenticators
--
-- Prerequisites:
--   - All services running the Kratos auth code (no Better Auth references remain)
--   - All active user sessions have been migrated to Kratos
--   - No code references these tables (verified by the merge PR)

BEGIN;

-- Drop tables in order of foreign key dependencies
DROP TABLE IF EXISTS public.nextauth_authenticators CASCADE;
DROP TABLE IF EXISTS public.nextauth_verificationtokens CASCADE;
DROP TABLE IF EXISTS public.nextauth_sessions CASCADE;
DROP TABLE IF EXISTS public.nextauth_accounts CASCADE;
DROP TABLE IF EXISTS public.passkey CASCADE;
DROP TABLE IF EXISTS public.two_factor CASCADE;
DROP TABLE IF EXISTS public.verifications CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;
DROP TABLE IF EXISTS public.auth_sessions CASCADE;

COMMIT;
