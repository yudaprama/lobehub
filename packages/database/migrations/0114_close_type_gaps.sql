-- Migration: close type gaps for prest-js-sdk *Input types
--
-- Adds columns the fork's services use but the DB schema lacks,
-- and DEFAULTs for server-generated IDs / timestamps that the
-- pg-to-ts fork couldn't detect (NOT NULL without DEFAULT).

-- 1. sessions.metadata — stores agent/session config (used by agent.ts, session/index.ts)
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "metadata" jsonb;

-- 2. user_settings columns used by user/index.ts but missing from schema
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "interests" text[];
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "preference" jsonb;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "guide" jsonb;
ALTER TABLE "user_settings" ADD COLUMN IF NOT EXISTS "settings" jsonb;

-- 3. user_memories.last_accessed_at — add DEFAULT so inserts can omit it
ALTER TABLE "user_memories" ALTER COLUMN "last_accessed_at" SET DEFAULT now();

-- 4. Child memory table IDs — add DEFAULT gen_random_uuid()::text
ALTER TABLE "user_memories_activities" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "user_memories_contexts" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "user_memories_experiences" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "user_memories_identities" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
ALTER TABLE "user_memories_preferences" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;

-- 5. generation_topics.id — add DEFAULT
ALTER TABLE "generation_topics" ALTER COLUMN "id" SET DEFAULT gen_random_uuid()::text;
