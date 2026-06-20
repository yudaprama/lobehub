-- Custom SQL migration file, put your code below! --
-- Postgres full-text search indexes to replace ParadeDB pg_search.
-- Replaces the disabled 0093_add_bm25_indexes_with_icu.sql.
-- Each table gets a STORED generated tsvector column (weight-coded per source column)
-- and a GIN index. ts_rank() in the rewritten search repository uses these columns.

-- 1. agents: title(A), description(B), slug(C), tags(jsonb)(B), system_role(D)
ALTER TABLE agents ADD COLUMN IF NOT EXISTS agents_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(slug, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(tags::text, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(system_role, '')), 'D')
  ) STORED;
CREATE INDEX IF NOT EXISTS agents_tsv_idx ON agents USING GIN (agents_tsv);--> statement-breakpoint

-- 2. topics: title(A), content(B), description(C)
ALTER TABLE topics ADD COLUMN IF NOT EXISTS topics_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS topics_tsv_idx ON topics USING GIN (topics_tsv);--> statement-breakpoint

-- 3. files: name(A)
ALTER TABLE files ADD COLUMN IF NOT EXISTS files_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A')
  ) STORED;
CREATE INDEX IF NOT EXISTS files_tsv_idx ON files USING GIN (files_tsv);--> statement-breakpoint

-- 4. knowledge_bases: name(A), description(B)
ALTER TABLE knowledge_bases ADD COLUMN IF NOT EXISTS knowledge_bases_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B')
  ) STORED;
CREATE INDEX IF NOT EXISTS knowledge_bases_tsv_idx ON knowledge_bases USING GIN (knowledge_bases_tsv);--> statement-breakpoint

-- 5. user_memories: title(A), summary(B), details(B)
ALTER TABLE user_memories ADD COLUMN IF NOT EXISTS user_memories_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(details, '')), 'B')
  ) STORED;
CREATE INDEX IF NOT EXISTS user_memories_tsv_idx ON user_memories USING GIN (user_memories_tsv);--> statement-breakpoint

-- 6. chat_groups: title(A), description(B), content(C)
ALTER TABLE chat_groups ADD COLUMN IF NOT EXISTS chat_groups_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS chat_groups_tsv_idx ON chat_groups USING GIN (chat_groups_tsv);--> statement-breakpoint

-- 7. user_memories_contexts: title(A), description(B), current_status(C)
ALTER TABLE user_memories_contexts ADD COLUMN IF NOT EXISTS user_memories_contexts_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(current_status, '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS user_memories_contexts_tsv_idx ON user_memories_contexts USING GIN (user_memories_contexts_tsv);--> statement-breakpoint

-- 8. user_memories_preferences: conclusion_directives(A), suggestions(B)
ALTER TABLE user_memories_preferences ADD COLUMN IF NOT EXISTS user_memories_preferences_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(conclusion_directives, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(suggestions, '')), 'B')
  ) STORED;
CREATE INDEX IF NOT EXISTS user_memories_preferences_tsv_idx ON user_memories_preferences USING GIN (user_memories_preferences_tsv);--> statement-breakpoint

-- 9. user_memories_activities: notes(B), narrative(B), feedback(C)
ALTER TABLE user_memories_activities ADD COLUMN IF NOT EXISTS user_memories_activities_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(notes, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(narrative, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(feedback, '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS user_memories_activities_tsv_idx ON user_memories_activities USING GIN (user_memories_activities_tsv);--> statement-breakpoint

-- 10. user_memories_identities: description(B), role(B)
ALTER TABLE user_memories_identities ADD COLUMN IF NOT EXISTS user_memories_identities_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(role, '')), 'B')
  ) STORED;
CREATE INDEX IF NOT EXISTS user_memories_identities_tsv_idx ON user_memories_identities USING GIN (user_memories_identities_tsv);--> statement-breakpoint

-- 11. user_memories_experiences: situation(B), reasoning(B), possible_outcome(C), action(C), key_learning(C)
ALTER TABLE user_memories_experiences ADD COLUMN IF NOT EXISTS user_memories_experiences_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(situation, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(reasoning, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(possible_outcome, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(action, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(key_learning, '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS user_memories_experiences_tsv_idx ON user_memories_experiences USING GIN (user_memories_experiences_tsv);--> statement-breakpoint

-- 12. user_memory_persona_documents: tagline(A), persona(B)
ALTER TABLE user_memory_persona_documents ADD COLUMN IF NOT EXISTS user_memory_persona_documents_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(tagline, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(persona, '')), 'B')
  ) STORED;
CREATE INDEX IF NOT EXISTS user_memory_persona_documents_tsv_idx ON user_memory_persona_documents USING GIN (user_memory_persona_documents_tsv);--> statement-breakpoint

-- 13. documents: title(A), description(B), content(B), slug(C)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS documents_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(slug, '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS documents_tsv_idx ON documents USING GIN (documents_tsv);--> statement-breakpoint

-- 14. messages: content(B), summary(C)
ALTER TABLE messages ADD COLUMN IF NOT EXISTS messages_tsv tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(content, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'C')
  ) STORED;
CREATE INDEX IF NOT EXISTS messages_tsv_idx ON messages USING GIN (messages_tsv);--> statement-breakpoint
