import { Inject, Injectable } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { DRIZZLE_TOKEN, DrizzleDB } from '../db/drizzle.provider';

export interface AgentDeliveryStats {
  deliveredCount: number;
  failedCount: number;
  avgPickupToDeliveryMs: number | null;
}

export interface IReportingRepository {
  getAgentDeliveryStats(agentId: string): Promise<AgentDeliveryStats>;
}

export const REPORTING_REPOSITORY = 'REPORTING_REPOSITORY';

@Injectable()
export class DrizzleReportingRepository implements IReportingRepository {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDB) {}

  async getAgentDeliveryStats(agentId: string): Promise<AgentDeliveryStats> {
    const result = await this.db.execute<{
      delivered_count: string;
      failed_count: string;
      avg_pickup_to_delivery_ms: string | null;
    }>(sql`
      WITH pickup_times AS (
        SELECT parcel_id, MIN(occurred_at) AS occurred_at
        FROM delivery_events
        WHERE event_type = 'picked_up'
        GROUP BY parcel_id
      ),
      delivery_times AS (
        SELECT parcel_id, MAX(occurred_at) AS occurred_at
        FROM delivery_events
        WHERE event_type = 'delivered'
        GROUP BY parcel_id
      )
      SELECT
        COUNT(*) FILTER (WHERE p.status = 'delivered') AS delivered_count,
        COUNT(*) FILTER (WHERE p.status = 'failed')    AS failed_count,
        AVG(
          EXTRACT(EPOCH FROM (dt.occurred_at - pt.occurred_at)) * 1000
        ) FILTER (
          WHERE p.status = 'delivered'
            AND pt.occurred_at IS NOT NULL
            AND dt.occurred_at IS NOT NULL
        ) AS avg_pickup_to_delivery_ms
      FROM parcels p
      LEFT JOIN pickup_times pt ON pt.parcel_id = p.id
      LEFT JOIN delivery_times dt ON dt.parcel_id = p.id
      WHERE p.assigned_agent_id = ${agentId}
        AND p.status IN ('delivered', 'failed')
    `);

    const row = result.rows[0];
    if (!row) {
      return { deliveredCount: 0, failedCount: 0, avgPickupToDeliveryMs: null };
    }

    return {
      deliveredCount: Number(row.delivered_count),
      failedCount: Number(row.failed_count),
      // Check === null before Number() — Number(null) === 0, which would wrongly
      // turn "no timing data" into "zero ms average".
      // Number(null) === 0, so guard before converting — "no timing data" must stay null.
      // PERFORMANCE NOTE: if delivery_events grows very large (millions of rows), the CTE
      // approach above scans all pickup/delivery events before filtering by agent. Switch to
      // LEFT JOIN LATERAL with per-parcel correlated subqueries instead — each subquery runs
      // only against the rows for that parcel and can use (parcel_id, event_type, occurred_at)
      // index efficiently. Trade-off: LATERAL is Postgres-specific and harder to read.
      avgPickupToDeliveryMs:
        row.avg_pickup_to_delivery_ms === null
          ? null
          : Number(row.avg_pickup_to_delivery_ms),
    };
  }
}
