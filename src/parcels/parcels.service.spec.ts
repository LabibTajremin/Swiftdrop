import { ConstraintViolationError } from '../common/exceptions/constraint-violation.error';
import { InvalidStatusTransitionError } from '../common/exceptions/invalid-status-transition.error';
import { ResourceNotFoundError } from '../common/exceptions/resource-not-found.error';
import { AgentsService } from '../agents/agents.service';
import { CreateParcelDto } from './dto/parcel.schemas';
import { DeliveryEvent, IParcelsRepository, Parcel } from './parcels.repository';
import { ParcelsService } from './parcels.service';
import { PARCEL_TRANSITIONS, ParcelStatus } from './status-machine';

// ── helpers ──────────────────────────────────────────────────────────────────

const ALL_STATUSES: ParcelStatus[] = [
  'registered',
  'picked_up',
  'out_for_delivery',
  'delivered',
  'failed',
];

function makeParcel(overrides: Partial<Parcel> = {}): Parcel {
  return {
    id: 'parcel-uuid-1',
    trackingNumber: 'TRK-001',
    senderName: 'Alice',
    senderAddress: '1 Sender St',
    receiverName: 'Bob',
    receiverAddress: '2 Receiver Ave',
    status: 'registered',
    assignedAgentId: null,
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

function makeDto(overrides: Partial<CreateParcelDto> = {}): CreateParcelDto {
  return {
    tracking_number: 'TRK-001',
    sender_name: 'Alice',
    sender_address: '1 Sender St',
    receiver_name: 'Bob',
    receiver_address: '2 Receiver Ave',
    ...overrides,
  };
}

function makeMockRepo(): jest.Mocked<IParcelsRepository> {
  const repo: jest.Mocked<IParcelsRepository> = {
    create: jest.fn(),
    findById: jest.fn(),
    findByTrackingNumber: jest.fn(),
    findAll: jest.fn(),
    updateStatus: jest.fn(),
    assignAgent: jest.fn(),
    logEvent: jest.fn(),
    getHistory: jest.fn(),
    // Runs the callback with the same mock so existing expect(repo.X) assertions
    // keep working unchanged — the service sees the same recorded calls.
    transaction: jest.fn((fn) => fn(repo)) as jest.Mocked<IParcelsRepository>['transaction'],
  };
  return repo;
}

function makeMockAgentsService(): jest.Mocked<AgentsService> {
  return {
    createAgent: jest.fn(),
    setAvailability: jest.fn(),
    assignParcel: jest.fn(),
    getActiveDeliveries: jest.fn(),
    validateAvailableAgent: jest.fn(),
  } as unknown as jest.Mocked<AgentsService>;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('ParcelsService', () => {
  let service: ParcelsService;
  let repo: jest.Mocked<IParcelsRepository>;
  let agentsService: jest.Mocked<AgentsService>;

  beforeEach(() => {
    repo = makeMockRepo();
    agentsService = makeMockAgentsService();
    service = new ParcelsService(repo, agentsService);
  });

  // ── registerParcel ──────────────────────────────────────────────────────────

  describe('registerParcel', () => {
    it('creates the parcel and logs a registered event', async () => {
      const parcel = makeParcel();
      repo.create.mockResolvedValue(parcel);
      repo.logEvent.mockResolvedValue(undefined);

      const result = await service.registerParcel(makeDto());

      expect(repo.create).toHaveBeenCalledWith(makeDto());
      expect(repo.logEvent).toHaveBeenCalledWith(parcel.id, 'ci-test-failure');
      expect(result).toBe(parcel);
    });

    it('propagates ConstraintViolationError on duplicate tracking number', async () => {
      repo.create.mockRejectedValue(
        new ConstraintViolationError("Tracking number 'TRK-001' is already in use"),
      );

      await expect(service.registerParcel(makeDto())).rejects.toThrow(ConstraintViolationError);
      expect(repo.logEvent).not.toHaveBeenCalled();
    });

    it('does not log an event if create fails', async () => {
      repo.create.mockRejectedValue(new Error('db error'));
      await expect(service.registerParcel(makeDto())).rejects.toThrow();
      expect(repo.logEvent).not.toHaveBeenCalled();
    });
  });

  // ── updateStatus ────────────────────────────────────────────────────────────

  describe('updateStatus — transition matrix', () => {
    const cases: [ParcelStatus, ParcelStatus, boolean][] = ALL_STATUSES.flatMap((from) =>
      ALL_STATUSES.map((to): [ParcelStatus, ParcelStatus, boolean] => [
        from,
        to,
        PARCEL_TRANSITIONS[from].includes(to),
      ]),
    );

    it.each(cases)('%s -> %s: %s', async (from, to, valid) => {
      repo.findById.mockResolvedValue(makeParcel({ status: from }));
      repo.updateStatus.mockResolvedValue(makeParcel({ status: to }));
      repo.logEvent.mockResolvedValue(undefined);

      if (valid) {
        await expect(service.updateStatus('parcel-uuid-1', to)).resolves.toBeDefined();
        expect(repo.updateStatus).toHaveBeenCalledWith('parcel-uuid-1', to);
        expect(repo.logEvent).toHaveBeenCalledTimes(1);
      } else {
        await expect(service.updateStatus('parcel-uuid-1', to)).rejects.toThrow(
          InvalidStatusTransitionError,
        );
        expect(repo.updateStatus).not.toHaveBeenCalled();
        expect(repo.logEvent).not.toHaveBeenCalled();
      }
    });

    // Given: a parcel cannot jump directly from registered to delivered.
    it('rejects registered -> delivered specifically', async () => {
      repo.findById.mockResolvedValue(makeParcel({ status: 'registered' }));
      await expect(service.updateStatus('parcel-uuid-1', 'delivered')).rejects.toThrow(
        InvalidStatusTransitionError,
      );
      await expect(service.updateStatus('parcel-uuid-1', 'delivered')).rejects.toThrow(
        'registered -> delivered',
      );
    });
  });

  describe('updateStatus — event type mapping', () => {
    const validCases: [ParcelStatus, ParcelStatus, string][] = [
      ['registered', 'picked_up', 'picked_up'],
      ['registered', 'failed', 'failed_attempt'],
      ['picked_up', 'out_for_delivery', 'out_for_delivery'],
      ['picked_up', 'failed', 'failed_attempt'],
      ['out_for_delivery', 'delivered', 'delivered'],
      ['out_for_delivery', 'failed', 'failed_attempt'],
      ['failed', 'picked_up', 'picked_up'],
    ];

    it.each(validCases)('%s -> %s logs event_type %s', async (from, to, expectedEvent) => {
      repo.findById.mockResolvedValue(makeParcel({ status: from }));
      repo.updateStatus.mockResolvedValue(makeParcel({ status: to }));
      repo.logEvent.mockResolvedValue(undefined);

      await service.updateStatus('parcel-uuid-1', to);
      expect(repo.logEvent).toHaveBeenCalledWith('parcel-uuid-1', expectedEvent);
    });
  });

  describe('updateStatus — not found', () => {
    it('throws ResourceNotFoundError when parcel does not exist', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.updateStatus('missing-id', 'picked_up')).rejects.toThrow(
        ResourceNotFoundError,
      );
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });
  });

  // ── getTrackingHistory ──────────────────────────────────────────────────────

  describe('getTrackingHistory', () => {
    it('returns the delivery events for a parcel', async () => {
      const parcel = makeParcel();
      const events = [makeEvent(), makeEvent({ id: 'event-uuid-2', eventType: 'picked_up' })];
      repo.findById.mockResolvedValue(parcel);
      repo.getHistory.mockResolvedValue(events);

      const result = await service.getTrackingHistory(parcel.id);

      expect(repo.getHistory).toHaveBeenCalledWith(parcel.id);
      expect(result).toBe(events);
    });

    it('throws ResourceNotFoundError for unknown id', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.getTrackingHistory('missing-id')).rejects.toThrow(
        ResourceNotFoundError,
      );
      expect(repo.getHistory).not.toHaveBeenCalled();
    });
  });

  // ── listParcels ─────────────────────────────────────────────────────────────

  describe('listParcels', () => {
    it('delegates to repo.findAll and wraps with pagination metadata', async () => {
      const parcelsData = [makeParcel(), makeParcel({ id: 'parcel-uuid-2', trackingNumber: 'TRK-002' })];
      repo.findAll.mockResolvedValue({ data: parcelsData, total: 2 });

      const filters = { page: 1, limit: 20 };
      const result = await service.listParcels(filters);

      expect(repo.findAll).toHaveBeenCalledWith(filters);
      expect(result).toEqual({ data: parcelsData, total: 2, page: 1, limit: 20 });
    });

    it('passes filters through to the repository', async () => {
      repo.findAll.mockResolvedValue({ data: [], total: 0 });
      const filters = { status: 'registered' as ParcelStatus, page: 2, limit: 10 };
      await service.listParcels(filters);
      expect(repo.findAll).toHaveBeenCalledWith(filters);
    });
  });

  // ── retryParcel ─────────────────────────────────────────────────────────────

  describe('retryParcel', () => {
    it('logs requeued event, transitions to picked_up, and returns the updated parcel', async () => {
      const failedParcel = makeParcel({ status: 'failed' });
      const updatedParcel = makeParcel({ status: 'picked_up' });
      repo.findById.mockResolvedValue(failedParcel);
      repo.updateStatus.mockResolvedValue(updatedParcel);
      repo.logEvent.mockResolvedValue(undefined);

      const result = await service.retryParcel('parcel-uuid-1');

      expect(repo.logEvent).toHaveBeenCalledWith('parcel-uuid-1', 'requeued');
      expect(repo.updateStatus).toHaveBeenCalledWith('parcel-uuid-1', 'picked_up');
      expect(repo.logEvent).toHaveBeenCalledWith('parcel-uuid-1', 'picked_up');
      expect(repo.logEvent).toHaveBeenCalledTimes(2);
      expect(result).toBe(updatedParcel);
    });

    it.each(['registered', 'picked_up', 'out_for_delivery', 'delivered'] as const)(
      'throws InvalidStatusTransitionError when parcel status is %s (not failed)',
      async (status) => {
        repo.findById.mockResolvedValue(makeParcel({ status }));

        await expect(service.retryParcel('parcel-uuid-1')).rejects.toThrow(
          InvalidStatusTransitionError,
        );
        expect(repo.logEvent).not.toHaveBeenCalled();
        expect(repo.updateStatus).not.toHaveBeenCalled();
      },
    );

    it('throws ResourceNotFoundError when parcel does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.retryParcel('missing-id')).rejects.toThrow(ResourceNotFoundError);
      expect(repo.logEvent).not.toHaveBeenCalled();
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });

    // ── retryParcel with agent reassignment ──────────────────────────────────

    it('reassigns to the new agent before retrying when agentId is provided', async () => {
      const failedParcel  = makeParcel({ status: 'failed' });
      const updatedParcel = makeParcel({ status: 'picked_up', assignedAgentId: 'agent-uuid-2' });
      repo.findById.mockResolvedValue(failedParcel);
      agentsService.validateAvailableAgent.mockResolvedValue(undefined);
      repo.assignAgent.mockResolvedValue(makeParcel({ assignedAgentId: 'agent-uuid-2' }));
      repo.updateStatus.mockResolvedValue(updatedParcel);
      repo.logEvent.mockResolvedValue(undefined);

      const result = await service.retryParcel('parcel-uuid-1', 'agent-uuid-2');

      expect(agentsService.validateAvailableAgent).toHaveBeenCalledWith('agent-uuid-2');
      expect(repo.assignAgent).toHaveBeenCalledWith('parcel-uuid-1', 'agent-uuid-2');
      expect(repo.logEvent).toHaveBeenCalledWith('parcel-uuid-1', 'requeued');
      expect(repo.updateStatus).toHaveBeenCalledWith('parcel-uuid-1', 'picked_up');
      expect(repo.logEvent).toHaveBeenCalledWith('parcel-uuid-1', 'picked_up');
      expect(repo.logEvent).toHaveBeenCalledTimes(2);
      expect(result).toBe(updatedParcel);
    });

    it('reassignment happens before the requeued event is logged', async () => {
      repo.findById.mockResolvedValue(makeParcel({ status: 'failed' }));
      agentsService.validateAvailableAgent.mockResolvedValue(undefined);
      repo.assignAgent.mockResolvedValue(makeParcel({ assignedAgentId: 'agent-uuid-1' }));
      repo.updateStatus.mockResolvedValue(makeParcel({ status: 'picked_up' }));
      repo.logEvent.mockResolvedValue(undefined);

      await service.retryParcel('parcel-uuid-1', 'agent-uuid-1');

      const assignOrder  = repo.assignAgent.mock.invocationCallOrder[0];
      const requeueOrder = repo.logEvent.mock.invocationCallOrder[0];
      expect(assignOrder).toBeLessThan(requeueOrder);
    });

    it('does not call agentsService when no agentId is provided', async () => {
      repo.findById.mockResolvedValue(makeParcel({ status: 'failed' }));
      repo.updateStatus.mockResolvedValue(makeParcel({ status: 'picked_up' }));
      repo.logEvent.mockResolvedValue(undefined);

      await service.retryParcel('parcel-uuid-1');

      expect(agentsService.validateAvailableAgent).not.toHaveBeenCalled();
      expect(repo.assignAgent).not.toHaveBeenCalled();
    });

    it('throws ResourceNotFoundError when the new agent does not exist', async () => {
      repo.findById.mockResolvedValue(makeParcel({ status: 'failed' }));
      agentsService.validateAvailableAgent.mockRejectedValue(
        new ResourceNotFoundError('Agent', 'bad-agent'),
      );

      await expect(service.retryParcel('parcel-uuid-1', 'bad-agent')).rejects.toThrow(
        ResourceNotFoundError,
      );
      expect(repo.assignAgent).not.toHaveBeenCalled();
      expect(repo.logEvent).not.toHaveBeenCalled();
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });

    it('throws ConstraintViolationError when the new agent is not available', async () => {
      repo.findById.mockResolvedValue(makeParcel({ status: 'failed' }));
      agentsService.validateAvailableAgent.mockRejectedValue(
        new ConstraintViolationError('Agent is not available for assignment'),
      );

      await expect(service.retryParcel('parcel-uuid-1', 'agent-uuid-1')).rejects.toThrow(
        ConstraintViolationError,
      );
      await expect(service.retryParcel('parcel-uuid-1', 'agent-uuid-1')).rejects.toThrow(
        'not available',
      );
      expect(repo.assignAgent).not.toHaveBeenCalled();
      expect(repo.logEvent).not.toHaveBeenCalled();
      expect(repo.updateStatus).not.toHaveBeenCalled();
    });

    it('does not retry when parcel is not failed even if a valid agentId is provided', async () => {
      repo.findById.mockResolvedValue(makeParcel({ status: 'registered' }));

      await expect(service.retryParcel('parcel-uuid-1', 'agent-uuid-1')).rejects.toThrow(
        InvalidStatusTransitionError,
      );
      expect(agentsService.validateAvailableAgent).not.toHaveBeenCalled();
      expect(repo.assignAgent).not.toHaveBeenCalled();
      expect(repo.logEvent).not.toHaveBeenCalled();
    });
  });

  // ── findParcelById (service-to-service surface) ─────────────────────────────

  describe('findParcelById', () => {
    it('returns the parcel when it exists', async () => {
      const parcel = makeParcel();
      repo.findById.mockResolvedValue(parcel);

      const result = await service.findParcelById('parcel-uuid-1');

      expect(repo.findById).toHaveBeenCalledWith('parcel-uuid-1');
      expect(result).toBe(parcel);
    });

    it('throws ResourceNotFoundError when parcel does not exist', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.findParcelById('missing-id')).rejects.toThrow(ResourceNotFoundError);
    });
  });

  // ── assignAgentToParcel (service-to-service surface) ───────────────────────

  describe('assignAgentToParcel', () => {
    it('delegates to repo.assignAgent and returns the updated parcel', async () => {
      const updated = makeParcel({ assignedAgentId: 'agent-uuid-1' });
      repo.assignAgent.mockResolvedValue(updated);

      const result = await service.assignAgentToParcel('parcel-uuid-1', 'agent-uuid-1');

      expect(repo.assignAgent).toHaveBeenCalledWith('parcel-uuid-1', 'agent-uuid-1');
      expect(result).toBe(updated);
    });
  });
});
