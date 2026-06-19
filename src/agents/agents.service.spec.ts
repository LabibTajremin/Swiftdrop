import { ConstraintViolationError } from '../common/exceptions/constraint-violation.error';
import { ResourceNotFoundError } from '../common/exceptions/resource-not-found.error';
import { Parcel } from '../parcels/parcels.repository';
import { ParcelsService } from '../parcels/parcels.service';
import { Agent, IAgentsRepository } from './agents.repository';
import { AgentsService } from './agents.service';

// ── helpers ───────────────────────────────────────────────────────────────────

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'agent-uuid-1',
    name: 'Alice Driver',
    phone: '+1-555-0100',
    isAvailable: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeParcel(overrides: Partial<Parcel> = {}): Parcel {
  return {
    id: 'parcel-uuid-1',
    trackingNumber: 'TRK-001',
    senderName: 'Sender',
    senderAddress: '1 Main St',
    receiverName: 'Receiver',
    receiverAddress: '2 End Ave',
    status: 'registered',
    assignedAgentId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeMockAgentRepo(): jest.Mocked<IAgentsRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    setAvailability: jest.fn(),
    findActiveDeliveries: jest.fn(),
  };
}

function makeMockParcelsService(): jest.Mocked<ParcelsService> {
  return {
    findParcelById: jest.fn(),
    assignAgentToParcel: jest.fn(),
  } as unknown as jest.Mocked<ParcelsService>;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('AgentsService', () => {
  let service: AgentsService;
  let agentRepo: jest.Mocked<IAgentsRepository>;
  let parcelsService: jest.Mocked<ParcelsService>;

  beforeEach(() => {
    agentRepo = makeMockAgentRepo();
    parcelsService = makeMockParcelsService();
    service = new AgentsService(agentRepo, parcelsService);
  });

  // ── createAgent ─────────────────────────────────────────────────────────────

  describe('createAgent', () => {
    it('delegates to the repository and returns the created agent', async () => {
      const dto = { name: 'Alice', phone: '+1-555-0100' };
      const agent = makeAgent();
      agentRepo.create.mockResolvedValue(agent);

      const result = await service.createAgent(dto);

      expect(agentRepo.create).toHaveBeenCalledWith(dto);
      expect(result).toBe(agent);
    });
  });

  // ── setAvailability ─────────────────────────────────────────────────────────

  describe('setAvailability', () => {
    it('sets agent availability to true', async () => {
      const agent = makeAgent({ isAvailable: true });
      agentRepo.setAvailability.mockResolvedValue(agent);

      const result = await service.setAvailability('agent-uuid-1', true);

      expect(agentRepo.setAvailability).toHaveBeenCalledWith('agent-uuid-1', true);
      expect(result.isAvailable).toBe(true);
    });

    it('sets agent availability to false', async () => {
      const agent = makeAgent({ isAvailable: false });
      agentRepo.setAvailability.mockResolvedValue(agent);

      const result = await service.setAvailability('agent-uuid-1', false);

      expect(agentRepo.setAvailability).toHaveBeenCalledWith('agent-uuid-1', false);
      expect(result.isAvailable).toBe(false);
    });

    it('propagates ResourceNotFoundError from the repository', async () => {
      agentRepo.setAvailability.mockRejectedValue(new ResourceNotFoundError('Agent', 'bad-id'));

      await expect(service.setAvailability('bad-id', true)).rejects.toThrow(ResourceNotFoundError);
    });
  });

  // ── assignParcel ────────────────────────────────────────────────────────────

  describe('assignParcel', () => {
    it('assigns parcel to an available agent with a registered parcel', async () => {
      const agent = makeAgent({ isAvailable: true });
      const parcel = makeParcel({ status: 'registered' });
      const assigned = makeParcel({ assignedAgentId: 'agent-uuid-1' });

      agentRepo.findById.mockResolvedValue(agent);
      parcelsService.findParcelById.mockResolvedValue(parcel);
      parcelsService.assignAgentToParcel.mockResolvedValue(assigned);

      const result = await service.assignParcel('agent-uuid-1', 'parcel-uuid-1');

      expect(agentRepo.findById).toHaveBeenCalledWith('agent-uuid-1');
      expect(parcelsService.findParcelById).toHaveBeenCalledWith('parcel-uuid-1');
      expect(parcelsService.assignAgentToParcel).toHaveBeenCalledWith('parcel-uuid-1', 'agent-uuid-1');
      expect(result.assignedAgentId).toBe('agent-uuid-1');
    });

    it('throws ResourceNotFoundError when the agent does not exist', async () => {
      agentRepo.findById.mockResolvedValue(null);

      await expect(service.assignParcel('bad-agent', 'parcel-uuid-1')).rejects.toThrow(
        ResourceNotFoundError,
      );
      expect(parcelsService.findParcelById).not.toHaveBeenCalled();
      expect(parcelsService.assignAgentToParcel).not.toHaveBeenCalled();
    });

    it('throws ConstraintViolationError when agent is not available', async () => {
      agentRepo.findById.mockResolvedValue(makeAgent({ isAvailable: false }));

      await expect(service.assignParcel('agent-uuid-1', 'parcel-uuid-1')).rejects.toThrow(
        ConstraintViolationError,
      );
      await expect(service.assignParcel('agent-uuid-1', 'parcel-uuid-1')).rejects.toThrow(
        'not available',
      );
      expect(parcelsService.findParcelById).not.toHaveBeenCalled();
    });

    it('throws ResourceNotFoundError when the parcel does not exist', async () => {
      agentRepo.findById.mockResolvedValue(makeAgent({ isAvailable: true }));
      parcelsService.findParcelById.mockRejectedValue(
        new ResourceNotFoundError('Parcel', 'bad-parcel'),
      );

      await expect(service.assignParcel('agent-uuid-1', 'bad-parcel')).rejects.toThrow(
        ResourceNotFoundError,
      );
      expect(parcelsService.assignAgentToParcel).not.toHaveBeenCalled();
    });

    it.each(['picked_up', 'out_for_delivery', 'delivered', 'failed'] as const)(
      'throws ConstraintViolationError when parcel is in %s status',
      async (status) => {
        agentRepo.findById.mockResolvedValue(makeAgent({ isAvailable: true }));
        parcelsService.findParcelById.mockResolvedValue(makeParcel({ status }));

        await expect(service.assignParcel('agent-uuid-1', 'parcel-uuid-1')).rejects.toThrow(
          ConstraintViolationError,
        );
        await expect(service.assignParcel('agent-uuid-1', 'parcel-uuid-1')).rejects.toThrow(
          'registered',
        );
        expect(parcelsService.assignAgentToParcel).not.toHaveBeenCalled();
      },
    );
  });

  // ── getActiveDeliveries ─────────────────────────────────────────────────────

  describe('getActiveDeliveries', () => {
    it('returns active (non-terminal) parcels for the agent', async () => {
      const agent = makeAgent();
      const activeParcels = [
        makeParcel({ id: 'p1', status: 'picked_up', assignedAgentId: 'agent-uuid-1' }),
        makeParcel({ id: 'p2', status: 'out_for_delivery', assignedAgentId: 'agent-uuid-1' }),
      ];
      agentRepo.findById.mockResolvedValue(agent);
      agentRepo.findActiveDeliveries.mockResolvedValue(activeParcels);

      const result = await service.getActiveDeliveries('agent-uuid-1');

      expect(agentRepo.findActiveDeliveries).toHaveBeenCalledWith('agent-uuid-1');
      expect(result).toBe(activeParcels);
    });

    it('does not return delivered or failed parcels (repo contract, verified via mock)', async () => {
      const agent = makeAgent();
      const activeOnly = [makeParcel({ status: 'picked_up', assignedAgentId: 'agent-uuid-1' })];
      agentRepo.findById.mockResolvedValue(agent);
      agentRepo.findActiveDeliveries.mockResolvedValue(activeOnly);

      const result = await service.getActiveDeliveries('agent-uuid-1');

      const nonActive = result.filter((p) => p.status === 'delivered' || p.status === 'failed');
      expect(nonActive).toHaveLength(0);
    });

    it('throws ResourceNotFoundError when agent does not exist', async () => {
      agentRepo.findById.mockResolvedValue(null);

      await expect(service.getActiveDeliveries('bad-id')).rejects.toThrow(ResourceNotFoundError);
      expect(agentRepo.findActiveDeliveries).not.toHaveBeenCalled();
    });
  });

  // ── validateAvailableAgent ──────────────────────────────────────────────────

  describe('validateAvailableAgent', () => {
    it('resolves without a value when agent exists and is available', async () => {
      agentRepo.findById.mockResolvedValue(makeAgent({ isAvailable: true }));

      await expect(service.validateAvailableAgent('agent-uuid-1')).resolves.toBeUndefined();
      expect(agentRepo.findById).toHaveBeenCalledWith('agent-uuid-1');
    });

    it('throws ResourceNotFoundError when agent does not exist', async () => {
      agentRepo.findById.mockResolvedValue(null);

      await expect(service.validateAvailableAgent('bad-id')).rejects.toThrow(ResourceNotFoundError);
    });

    it('throws ConstraintViolationError when agent is not available', async () => {
      agentRepo.findById.mockResolvedValue(makeAgent({ isAvailable: false }));

      await expect(service.validateAvailableAgent('agent-uuid-1')).rejects.toThrow(
        ConstraintViolationError,
      );
      await expect(service.validateAvailableAgent('agent-uuid-1')).rejects.toThrow('not available');
    });
  });
});
