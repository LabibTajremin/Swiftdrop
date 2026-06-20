import { AgentDeliveryStats, IReportingRepository } from './reporting.repository';
import { ReportingService } from './reporting.service';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeMockRepo(): jest.Mocked<IReportingRepository> {
  return { getAgentDeliveryStats: jest.fn() };
}

function makeStats(overrides: Partial<AgentDeliveryStats> = {}): AgentDeliveryStats {
  return {
    deliveredCount: 0,
    failedCount: 0,
    avgPickupToDeliveryMs: null,
    ...overrides,
  };
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('ReportingService', () => {
  let service: ReportingService;
  let repo: jest.Mocked<IReportingRepository>;

  beforeEach(() => {
    repo = makeMockRepo();
    service = new ReportingService(repo);
  });

  describe('getAgentSummary', () => {
    it('computes correct summary for a mix of delivered and failed parcels', async () => {
      repo.getAgentDeliveryStats.mockResolvedValue(
        makeStats({ deliveredCount: 2, failedCount: 1, avgPickupToDeliveryMs: 5400000 }),
      );

      const result = await service.getAgentSummary('agent-uuid-1');

      expect(result.agent_id).toBe('agent-uuid-1');
      expect(result.total_deliveries).toBe(3);
      expect(result.success_rate).toBeCloseTo(2 / 3);
      expect(result.avg_pickup_to_delivery_ms).toBe(5400000);
    });

    it('returns success_rate=0 and avg=null when agent has no terminal deliveries', async () => {
      repo.getAgentDeliveryStats.mockResolvedValue(makeStats());

      const result = await service.getAgentSummary('agent-uuid-1');

      expect(result.total_deliveries).toBe(0);
      expect(result.success_rate).toBe(0);
      expect(result.success_rate).not.toBeNaN();
      expect(result.avg_pickup_to_delivery_ms).toBeNull();
    });

    it('returns success_rate=0 and avg=null when all parcels failed', async () => {
      repo.getAgentDeliveryStats.mockResolvedValue(makeStats({ failedCount: 3 }));

      const result = await service.getAgentSummary('agent-uuid-1');

      expect(result.total_deliveries).toBe(3);
      expect(result.success_rate).toBe(0);
      expect(result.success_rate).not.toBeNaN();
      expect(result.avg_pickup_to_delivery_ms).toBeNull();
    });

    it('returns success_rate=1 and correct avg when all parcels delivered', async () => {
      repo.getAgentDeliveryStats.mockResolvedValue(
        makeStats({ deliveredCount: 2, avgPickupToDeliveryMs: 6300000 }),
      );

      const result = await service.getAgentSummary('agent-uuid-1');

      expect(result.total_deliveries).toBe(2);
      expect(result.success_rate).toBe(1);
      expect(result.avg_pickup_to_delivery_ms).toBe(6300000);
    });

    it('passes through non-null avg from repo unchanged', async () => {
      // The SQL FILTER clause in DrizzleReportingRepository excludes delivered
      // parcels that lack picked_up/delivered events — the service receives the
      // already-correct number and passes it through without further computation.
      repo.getAgentDeliveryStats.mockResolvedValue(
        makeStats({ deliveredCount: 2, avgPickupToDeliveryMs: 3600000 }),
      );

      const result = await service.getAgentSummary('agent-uuid-1');

      expect(result.total_deliveries).toBe(2);
      expect(result.success_rate).toBe(1);
      expect(result.avg_pickup_to_delivery_ms).toBe(3600000);
    });

    it('passes through null avg from repo unchanged', async () => {
      // Repo returns null when no delivered parcel has both timing events.
      repo.getAgentDeliveryStats.mockResolvedValue(
        makeStats({ deliveredCount: 1, avgPickupToDeliveryMs: null }),
      );

      const result = await service.getAgentSummary('agent-uuid-1');

      expect(result.total_deliveries).toBe(1);
      expect(result.success_rate).toBe(1);
      expect(result.avg_pickup_to_delivery_ms).toBeNull();
    });

    it('passes the agentId through to the repository', async () => {
      repo.getAgentDeliveryStats.mockResolvedValue(makeStats());

      await service.getAgentSummary('some-agent-id');

      expect(repo.getAgentDeliveryStats).toHaveBeenCalledWith('some-agent-id');
    });
  });
});
