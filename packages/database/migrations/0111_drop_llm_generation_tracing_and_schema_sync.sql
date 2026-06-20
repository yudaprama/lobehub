-- Drop the deprecated llm_generation_tracing table and convert
-- verify_check_results.verifier_tracing_id from a uuid FK into an opaque
-- text column that stores a Tempo span ID (no FK).
--
-- Also drops the legacy NextAuth tables that were removed from the Drizzle
-- schema during the Kratos migration, and widens files.size / global_files.size
-- to bigint + document_chunks.document_id to varchar(255) so the TS schema
-- matches the live columns.
--
-- Idempotent: each DROP / ALTER is guarded by IF EXISTS / IF NOT EXISTS so
-- re-running against a DB that already absorbed these changes is a no-op.

ALTER TABLE IF EXISTS "accounts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "passkey" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "auth_sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "two_factor" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "verifications" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "llm_generation_tracing" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "nextauth_accounts" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "nextauth_authenticators" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "nextauth_sessions" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE IF EXISTS "nextauth_verificationtokens" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint

DROP TABLE IF EXISTS "accounts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "passkey" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "auth_sessions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "two_factor" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "verifications" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "llm_generation_tracing" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "nextauth_accounts" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "nextauth_authenticators" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "nextauth_sessions" CASCADE;--> statement-breakpoint
DROP TABLE IF EXISTS "nextauth_verificationtokens" CASCADE;--> statement-breakpoint

ALTER TABLE "verify_check_results" DROP CONSTRAINT IF EXISTS "verify_check_results_verifier_tracing_id_llm_generation_tracing_id_fk";--> statement-breakpoint
ALTER TABLE "files" ALTER COLUMN "size" SET DATA TYPE bigint USING "size"::bigint;--> statement-breakpoint
ALTER TABLE "global_files" ALTER COLUMN "size" SET DATA TYPE bigint USING "size"::bigint;--> statement-breakpoint
ALTER TABLE "document_chunks" ALTER COLUMN "document_id" SET DATA TYPE varchar(255);--> statement-breakpoint
ALTER TABLE "verify_check_results" ALTER COLUMN "verifier_tracing_id" SET DATA TYPE text;
