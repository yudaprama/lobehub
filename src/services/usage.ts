import { getLobehubQueryClient } from '@/libs/prest/client';

class UsageService {
  findByMonth = async (mo?: string) => {
    const db = await getLobehubQueryClient();

    // Tier 2 stored SQL template aggregates token/cost from messages.usage
    // jsonb for the given calendar month. The BFF path hits the same table
    // but builds the query in Drizzle — prest-js-sdk lets the frontend
    // bypass the BFF entirely for this read.
    const yearMonth = mo ?? new Date().toISOString().slice(0, 7);
    const startDate = `${yearMonth}-01T00:00:00Z`;
    // Last millisecond of the month (handles 28/29/30/31-day months via Date math):
    const end = new Date(startDate);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const endDate = end.toISOString();

    return db.query('lobehub', 'usageAggregateByDay', { startDate, endDate }, { camelCase: false });
  };

  findAndGroupByDay = async (mo?: string) => {
    const db = await getLobehubQueryClient();

    // Same Tier 2 template — the server-side groupByDay path also just
    // aggregates messages by day, so we route both procedures through the
    // same SQL. The frontend consumer only needs the day-bucketed totals.
    const yearMonth = mo ?? new Date().toISOString().slice(0, 7);
    const startDate = `${yearMonth}-01T00:00:00Z`;
    const end = new Date(startDate);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const endDate = end.toISOString();

    return db.query('lobehub', 'usageAggregateByDay', { startDate, endDate }, { camelCase: false });
  };
}

export const usageService = new UsageService();
