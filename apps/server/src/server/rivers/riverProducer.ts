/**
 * riverProducer.ts — BFF-side adapter that enqueues jobs into River's
 * river_job table via a direct SQL INSERT. This replaces the self-HTTP
 * call chain (createAsyncCaller → /trpc/async → async/file.ts handler)
 * with a one-shot INSERT that the egent-jobs worker picks up.
 *
 * River schema: https://riverqueue.com/docs
 *
 * Initialization is lazy: the first call pulls the cached drizzle
 * instance via getServerDB() — same pattern the trpc middleware uses.
 */
import { sql } from 'drizzle-orm';

import { getServerDB } from '@/database/server';
import type { LobeChatDatabase } from '@/database/type';

export const RiverJobKind = {
  EmbedFileChunks: 'embed_file_chunks',
  ParseFileToChunks: 'parse_file_to_chunks',
} as const;

export const RiverQueue = {
  FileIngest: 'file_ingest',
  MediaGen: 'media_gen',
} as const;

export interface EmbedFileChunksArgs {
  fileId: string;
  taskId: string;
  userId: string;
  workspaceId?: string;
}

export interface ParseFileToChunksArgs {
  fileId: string;
  taskId: string;
  userId: string;
  workspaceId?: string;
  skipExist?: boolean;
}

export interface RiverEnqueueOptions {
  maxAttempts?: number;
  queue?: string;
  tags?: string[];
}

/** Normalised exec signature used internally. */
type SqlExecFn = (q: { sql: string; params: any[] }) => Promise<{ rows: any[] }>;

export class RiverProducer {
  private readonly exec: SqlExecFn;

  constructor(db: LobeChatDatabase) {
    this.exec = async (q) => {
      const result = await db.execute(q);
      return { rows: result as unknown as any[] };
    };
  }

  async enqueueEmbedFileChunks(args: EmbedFileChunksArgs, opts?: RiverEnqueueOptions) {
    return this.insert(RiverJobKind.EmbedFileChunks, args, opts);
  }

  async enqueueParseFileToChunks(args: ParseFileToChunksArgs, opts?: RiverEnqueueOptions) {
    return this.insert(RiverJobKind.ParseFileToChunks, args, opts);
  }

  private async insert(kind: string, args: unknown, opts?: RiverEnqueueOptions) {
    const maxAttempts = opts?.maxAttempts ?? 5;
    const queue = opts?.queue ?? RiverQueue.FileIngest;
    const tags = opts?.tags ?? [];
    const tagsLit = tags.length > 0 ? `{${tags.join(',')}}` : '{}';

    const result = await this.exec(sql`
      INSERT INTO river_job
        (kind, args, queue, max_attempts, tags, metadata, state, priority, attempt, created_at, scheduled_at)
      VALUES
        (${kind}, ${sql`COALESCE(${JSON.stringify(args)}::jsonb, '{}'::jsonb)`},
         ${queue}, ${maxAttempts}, ${tagsLit}::text[],
         '{}'::jsonb, 1, 2, 0, now(), now())
      RETURNING id
    ` as any);

    const rows = Array.isArray(result.rows) ? result.rows : (result.rows as any)?.rows ?? [];
    const row = rows[0];
    if (!row) throw new Error(`riverProducer: INSERT ${kind} returned no row`);
    return { jobId: row.id };
  }

  /**
   * Probe whether the river_job table exists. The BFF uses this at the
   * call site to decide whether to fall back to the legacy self-HTTP
   * path when egent-jobs hasn't been deployed yet.
   */
  async isHealthy(): Promise<boolean> {
    try {
      await this.exec(sql`SELECT 1 FROM river_job LIMIT 1` as any);
      return true;
    } catch {
      return false;
    }
  }
}

// ─── Lazy singleton ──────────────────────────────────────────────────

let producerPromise: Promise<RiverProducer> | null = null;

/**
 * Lazy init. The first call pulls the cached drizzle instance via
 * getServerDB(); subsequent calls return the same producer. No boot
 * wiring required.
 */
async function getProducer(): Promise<RiverProducer> {
  if (!producerPromise) {
    producerPromise = (async () => {
      const db = await getServerDB();
      return new RiverProducer(db);
    })();
  }
  return producerPromise;
}

/**
 * Enqueue helpers — exported so callers don't have to await the singleton.
 * These are the primary entry points from the service layer.
 */
export async function enqueueEmbedFileChunks(
  args: EmbedFileChunksArgs,
  opts?: RiverEnqueueOptions,
) {
  const p = await getProducer();
  return p.enqueueEmbedFileChunks(args, opts);
}

export async function enqueueParseFileToChunks(
  args: ParseFileToChunksArgs,
  opts?: RiverEnqueueOptions,
) {
  const p = await getProducer();
  return p.enqueueParseFileToChunks(args, opts);
}

/**
 * True if we've already constructed a producer. Use this to short-circuit
 * the River path when the river_job table is missing — see isRiverHealthy.
 */
export function isRiverProducerConfigured(): boolean {
  return producerPromise !== null;
}

/**
 * Health probe. Use this at the service layer to decide whether to
 * enqueue via River or fall back to the legacy self-HTTP path:
 *
 *   if (await isRiverHealthy()) { enqueueEmbedFileChunks(...) }
 *   else { /* legacy async caller path *\/ }
 *
 * The first call lazily constructs the producer.
 */
export async function isRiverHealthy(): Promise<boolean> {
  try {
    const p = await getProducer();
    return await p.isHealthy();
  } catch {
    return false;
  }
}
