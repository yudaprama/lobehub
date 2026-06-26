-- backfillAgentId.sql — ONE-SHOT data backfill (run once, then delete this file)
-- =================================================================================
-- Purpose:  stamp `agent_id` onto every legacy `topics` / `messages` row that
--           lacks one, deriving it from `agents_to_sessions` (session -> agent).
--
-- Why:      The "new agent system" stamps every topic/message with an agent_id,
--           but rows created before that field existed have agent_id IS NULL.
--           The TS backend currently backfills this ON THE REQUEST PATH
--           (`AgentMigrationRepo.migrateBySession` / `migrateInbox` in
--           packages/database/src/repositories/agentMigration + the
--           `resolveAgentIdFromSession` helper in routers/lambda/_helpers/
--           resolveContext.ts) every time getTopics / recentTopics / searchTopics
--           / getMessages is called. That request-path work blocks deleting the
--           TS topic/message routers (MVP goal) AND blocks the existing pREST
--           Tier 2 templates (topicsListBySession, recentByUser, topicsSearchFts,
--           messagesListByTopic) from being used directly.
--
--           Running this once moves that work out of the hot path. After it
--           completes (and the residue is verified empty), the request-path
--           migration calls can be dropped and the templates apply as-is.
--           See MVP_ROADMAP.md Phase 4 backfills + FRONTEND_LAMBDACLIENT_BREAKDOWN.md
--           ("One-shot backfills for legacy hot-path compat").
--
-- Idempotent: every UPDATE is gated on `agent_id IS NULL`, so re-running is a
--             no-op once a row is filled. Safe to re-run.
--
-- updated_at is preserved explicitly (mirrors the repo's `updatedAt: <col>.updatedAt`
-- override of Drizzle's $onUpdate) so the backfill does not churn row mtimes /
-- re-sort "recent" views.
--
-- Run:       psql "$DATABASE_URL" -f scripts/backfillAgentId.sql
--            (or paste into the Supabase SQL editor)
--
-- Verify:    the trailing SELECTs report any remaining NULL agent_id rows; the
--            target end state is 0 remaining for session-backed rows.
-- =================================================================================

BEGIN;

-- ---------------------------------------------------------------------------------
-- Step 1 — Topics that have a session: derive agent_id from agents_to_sessions.
--           (global port of AgentMigrationRepo.migrateBySession, topics branch)
-- ---------------------------------------------------------------------------------
UPDATE topics
SET    agent_id = r.agent_id,
       updated_at = topics.updated_at
FROM   (SELECT session_id, agent_id
        FROM   agents_to_sessions
        WHERE  agent_id IS NOT NULL) r
WHERE  topics.agent_id IS NULL
  AND  topics.session_id IS NOT NULL
  AND  topics.session_id = r.session_id;

-- ---------------------------------------------------------------------------------
-- Step 2 — Messages that have a topic: inherit the topic's agent_id (filled in
--           step 1). (port of migrateBySession, messages-by-topic branch)
-- ---------------------------------------------------------------------------------
UPDATE messages
SET    agent_id = t.agent_id,
       updated_at = messages.updated_at
FROM   topics t
WHERE  messages.agent_id IS NULL
  AND  messages.topic_id IS NOT NULL
  AND  messages.topic_id = t.id
  AND  t.agent_id IS NOT NULL;

-- ---------------------------------------------------------------------------------
-- Step 3 — Messages that have a session but no topic: derive from
--           agents_to_sessions. (port of migrateBySession, messages-by-session branch)
-- ---------------------------------------------------------------------------------
UPDATE messages
SET    agent_id = r.agent_id,
       updated_at = messages.updated_at
FROM   (SELECT session_id, agent_id
        FROM   agents_to_sessions
        WHERE  agent_id IS NOT NULL) r
WHERE  messages.agent_id IS NULL
  AND  messages.topic_id IS NULL
  AND  messages.session_id IS NOT NULL
  AND  messages.session_id = r.session_id;

-- ---------------------------------------------------------------------------------
-- Step 4 (OPTIONAL, conservative) — Inbox orphan topics: no session, no group,
--           no agent. These can only be categorized in recentTopics if they have
--           an agent_id. We assign one ONLY for users with exactly one agent
--           (unambiguous); multi-agent users are left for manual review to avoid
--           mis-assigning. Skip this block if you'd rather handle inbox manually.
--           (port of AgentMigrationRepo.migrateInbox, restricted to single-agent users)
-- ---------------------------------------------------------------------------------
UPDATE topics
SET    agent_id = u.agent_id,
       updated_at = topics.updated_at
FROM   (
        -- agents PK is `id` (not agent_id); agents_to_sessions.agent_id refs it.
        SELECT user_id, MIN(id) AS agent_id
        FROM   agents
        GROUP  BY user_id
        HAVING COUNT(*) = 1
       ) u
WHERE  topics.agent_id IS NULL
  AND  topics.session_id IS NULL
  AND  topics.group_id   IS NULL
  AND  topics.user_id = u.user_id;

-- And their messages (inherit from the topic just filled).
UPDATE messages
SET    agent_id = t.agent_id,
       updated_at = messages.updated_at
FROM   topics t
WHERE  messages.agent_id IS NULL
  AND  messages.topic_id IS NOT NULL
  AND  messages.topic_id = t.id
  AND  t.agent_id IS NOT NULL;

COMMIT;

-- =================================================================================
-- Verification (run after COMMIT; not inside the txn so partial progress is still
-- committed even if you only wanted to inspect). Target end state: 0 / 0 / 0.
-- =================================================================================
SELECT 'topics:  agent_id still NULL (session-backed)' AS check_name,
       COUNT(*) AS remaining
FROM   topics
WHERE  agent_id IS NULL AND session_id IS NOT NULL
UNION ALL
SELECT 'topics:  agent_id still NULL (inbox orphan, multi-agent user)',
       COUNT(*)
FROM   topics
WHERE  agent_id IS NULL AND session_id IS NULL AND group_id IS NULL
UNION ALL
SELECT 'messages: agent_id still NULL (has topic or session)',
       COUNT(*)
FROM   messages
WHERE  agent_id IS NULL AND (topic_id IS NOT NULL OR session_id IS NOT NULL);
