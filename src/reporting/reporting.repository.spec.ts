import { DrizzleDB } from '../db/drizzle.provider';
import { DrizzleReportingRepository } from './reporting.repository';

// ── helpers ───────────────────────────────────────────────────────────────────

type FakeRow = {
  delivered_count: string;
  failed_count: string;
  avg_pickup_to_delivery_ms: string | null;
};

function makeDb(rows: FakeRow[]): { execute: jest.Mock } {
  return { execute: jest.fn().mockResolvedValue({ rows }) };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('DrizzleReportingRepository.getAgentDeliveryStats', () => {
  it('parses a normal mixed delivered/failed result row correctly', async () => {
    const db = makeDb([{ delivered_count: '2', failed_count: '1', avg_pickup_to_delivery_ms: '5400000' }]);
    const repo = new DrizzleReportingRepository(db as unknown as DrizzleDB);

    const result = await repo.getAgentDeliveryStats('agent-uuid-1');

    expect(result.deliveredCount).toBe(2);
    expect(result.failedCount).toBe(1);
    expect(result.avgPickupToDeliveryMs).toBe(5400000);
  });

  it('returns null avg when Postgres returns NULL (no timing events)', async () => {
    const db = makeDb([{ delivered_count: '1', failed_count: '0', avg_pickup_to_delivery_ms: null }]);
    const repo = new DrizzleReportingRepository(db as unknown as DrizzleDB);

    const result = await repo.getAgentDeliveryStats('agent-uuid-1');

    expect(result.deliveredCount).toBe(1);
    expect(result.failedCount).toBe(0);
    // Must be null not 0 — Number(null) === 0 would be a silent wrong answer
    expect(result.avgPickupToDeliveryMs).toBeNull();
  });

  it('returns zero counts and null avg when no matching parcels exist', async () => {
    // A GROUP BY-less aggregate over zero rows still returns one row with COUNT=0, AVG=NULL
    const db = makeDb([{ delivered_count: '0', failed_count: '0', avg_pickup_to_delivery_ms: null }]);
    const repo = new DrizzleReportingRepository(db as unknown as DrizzleDB);

    const result = await repo.getAgentDeliveryStats('agent-uuid-1');

    expect(result.deliveredCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.avgPickupToDeliveryMs).toBeNull();
  });

  it('returns zero counts and null avg defensively when rows is empty', async () => {
    // Should not happen in practice but guards against future query shape changes
    const db = makeDb([]);
    const repo = new DrizzleReportingRepository(db as unknown as DrizzleDB);

    const result = await repo.getAgentDeliveryStats('agent-uuid-1');

    expect(result.deliveredCount).toBe(0);
    expect(result.failedCount).toBe(0);
    expect(result.avgPickupToDeliveryMs).toBeNull();
  });

  it('parses fractional avg_pickup_to_delivery_ms correctly', async () => {
    const db = makeDb([{ delivered_count: '1', failed_count: '0', avg_pickup_to_delivery_ms: '3600000.5' }]);
    const repo = new DrizzleReportingRepository(db as unknown as DrizzleDB);

    const result = await repo.getAgentDeliveryStats('agent-uuid-1');

    expect(result.avgPickupToDeliveryMs).toBe(3600000.5);
  });
});
