import { DeliveryEvent, Parcel } from '../parcels/parcels.repository';
import { IReportingRepository, ParcelWithEvents } from './reporting.repository';
import { ReportingService } from './reporting.service';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeParcel(overrides: Partial<Parcel> = {}): Parcel {
  return {
    id: 'parcel-uuid-1',
    trackingNumber: 'TRK-001',
    senderName: 'Sender',
    senderAddress: '1 Main St',
    receiverName: 'Receiver',
    receiverAddress: '2 End Ave',
    status: 'delivered',
    assignedAgentId: 'agent-uuid-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeEvent(overrides: Partial<DeliveryEvent> = {}): DeliveryEvent {
  return {
    id: 'event-uuid-1',
    parcelId: 'parcel-uuid-1',
    eventType: 'registered',
    notes: null,
    occurredAt: new Date(),
    ...overrides,
  };
}

function makeDeliveredParcel(
  parcelId: string,
  pickupTime: Date,
  deliveryTime: Date,
): ParcelWithEvents {
  return {
    parcel: makeParcel({ id: parcelId, status: 'delivered' }),
    events: [
      makeEvent({ id: `${parcelId}-e1`, parcelId, eventType: 'picked_up', occurredAt: pickupTime }),
      makeEvent({ id: `${parcelId}-e2`, parcelId, eventType: 'delivered', occurredAt: deliveryTime }),
    ],
  };
}

function makeFailedParcel(parcelId: string): ParcelWithEvents {
  return {
    parcel: makeParcel({ id: parcelId, status: 'failed' }),
    events: [
      makeEvent({ id: `${parcelId}-e1`, parcelId, eventType: 'picked_up', occurredAt: new Date() }),
      makeEvent({ id: `${parcelId}-e2`, parcelId, eventType: 'failed_attempt', occurredAt: new Date() }),
    ],
  };
}

function makeMockRepo(): jest.Mocked<IReportingRepository> {
  return { getAgentDeliveryData: jest.fn() };
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
      const t0 = new Date('2026-01-01T09:00:00Z');
      const t1 = new Date('2026-01-01T10:00:00Z'); // 1 hour = 3600000ms
      const t2 = new Date('2026-01-01T11:00:00Z'); // 2 hours = 7200000ms

      repo.getAgentDeliveryData.mockResolvedValue([
        makeDeliveredParcel('p1', t0, t1),  // 3600000ms
        makeDeliveredParcel('p2', t0, t2),  // 7200000ms
        makeFailedParcel('p3'),
      ]);

      const result = await service.getAgentSummary('agent-uuid-1');

      expect(result.agent_id).toBe('agent-uuid-1');
      expect(result.total_deliveries).toBe(3);
      expect(result.success_rate).toBeCloseTo(2 / 3);
      expect(result.avg_pickup_to_delivery_ms).toBe(5400000); // (3600000 + 7200000) / 2
    });

    it('returns success_rate=0 and avg=null when agent has no terminal deliveries', async () => {
      repo.getAgentDeliveryData.mockResolvedValue([]);

      const result = await service.getAgentSummary('agent-uuid-1');

      expect(result.total_deliveries).toBe(0);
      expect(result.success_rate).toBe(0);
      expect(result.avg_pickup_to_delivery_ms).toBeNull();
      expect(result.success_rate).not.toBeNaN();
    });

    it('returns success_rate=0 and avg=null when all parcels failed', async () => {
      repo.getAgentDeliveryData.mockResolvedValue([
        makeFailedParcel('p1'),
        makeFailedParcel('p2'),
        makeFailedParcel('p3'),
      ]);

      const result = await service.getAgentSummary('agent-uuid-1');

      expect(result.total_deliveries).toBe(3);
      expect(result.success_rate).toBe(0);
      expect(result.success_rate).not.toBeNaN();
      expect(result.avg_pickup_to_delivery_ms).toBeNull();
    });

    it('returns success_rate=1 and correct avg when all parcels delivered', async () => {
      const t0 = new Date('2026-01-01T08:00:00Z');
      const t1 = new Date('2026-01-01T09:00:00Z'); // 3600000ms
      const t2 = new Date('2026-01-01T10:30:00Z'); // 9000000ms

      repo.getAgentDeliveryData.mockResolvedValue([
        makeDeliveredParcel('p1', t0, t1),
        makeDeliveredParcel('p2', t0, t2),
      ]);

      const result = await service.getAgentSummary('agent-uuid-1');

      expect(result.total_deliveries).toBe(2);
      expect(result.success_rate).toBe(1);
      expect(result.avg_pickup_to_delivery_ms).toBe(6300000); // (3600000 + 9000000) / 2
    });

    it('excludes delivered parcels with missing events from avg calculation', async () => {
      const t0 = new Date('2026-01-01T08:00:00Z');
      const t1 = new Date('2026-01-01T09:00:00Z');

      repo.getAgentDeliveryData.mockResolvedValue([
        makeDeliveredParcel('p1', t0, t1),               // 3600000ms — included
        {
          parcel: makeParcel({ id: 'p2', status: 'delivered' }),
          events: [],                                      // no events — skipped
        },
      ]);

      const result = await service.getAgentSummary('agent-uuid-1');

      expect(result.total_deliveries).toBe(2);
      expect(result.success_rate).toBe(1);
      expect(result.avg_pickup_to_delivery_ms).toBe(3600000);
    });

    it('returns avg=null when all delivered parcels have no timing events', async () => {
      repo.getAgentDeliveryData.mockResolvedValue([
        { parcel: makeParcel({ id: 'p1', status: 'delivered' }), events: [] },
      ]);

      const result = await service.getAgentSummary('agent-uuid-1');

      expect(result.total_deliveries).toBe(1);
      expect(result.success_rate).toBe(1);
      expect(result.avg_pickup_to_delivery_ms).toBeNull();
    });

    it('passes the agentId through to the repository', async () => {
      repo.getAgentDeliveryData.mockResolvedValue([]);

      await service.getAgentSummary('some-agent-id');

      expect(repo.getAgentDeliveryData).toHaveBeenCalledWith('some-agent-id');
    });
  });
});
