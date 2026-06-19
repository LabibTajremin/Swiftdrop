import { InvalidStatusTransitionError } from '../common/exceptions/invalid-status-transition.error';
import { ResourceNotFoundError } from '../common/exceptions/resource-not-found.error';
import { DeliveryEvent, Parcel } from '../parcels/parcels.repository';
import { ParcelsService } from '../parcels/parcels.service';
import { IDeliveryEventsRepository } from './delivery-events.repository';
import { DeliveryEventsService } from './delivery-events.service';

// ── helpers ───────────────────────────────────────────────────────────────────

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

function makeMockEventsRepo(): jest.Mocked<IDeliveryEventsRepository> {
  return {
    create: jest.fn(),
    findByParcelId: jest.fn(),
  };
}

function makeMockParcelsService(): jest.Mocked<ParcelsService> {
  return {
    findParcelById: jest.fn(),
    updateStatus: jest.fn(),
  } as unknown as jest.Mocked<ParcelsService>;
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe('DeliveryEventsService', () => {
  let service: DeliveryEventsService;
  let eventsRepo: jest.Mocked<IDeliveryEventsRepository>;
  let parcelsService: jest.Mocked<ParcelsService>;

  beforeEach(() => {
    eventsRepo = makeMockEventsRepo();
    parcelsService = makeMockParcelsService();
    service = new DeliveryEventsService(eventsRepo, parcelsService);
  });

  // ── logEvent ─────────────────────────────────────────────────────────────────

  describe('logEvent', () => {
    describe('status-changing events', () => {
      it.each([
        ['picked_up', 'picked_up'],
        ['out_for_delivery', 'out_for_delivery'],
        ['delivered', 'delivered'],
        ['failed_attempt', 'failed'],
      ] as const)(
        'delegates %s event to ParcelsService.updateStatus with status "%s"',
        async (eventType, expectedStatus) => {
          const parcel = makeParcel();
          const updatedParcel = makeParcel({ status: expectedStatus });
          parcelsService.findParcelById.mockResolvedValue(parcel);
          parcelsService.updateStatus.mockResolvedValue(updatedParcel);

          const result = await service.logEvent({ parcel_id: 'parcel-uuid-1', event_type: eventType });

          expect(parcelsService.findParcelById).toHaveBeenCalledWith('parcel-uuid-1');
          expect(parcelsService.updateStatus).toHaveBeenCalledWith('parcel-uuid-1', expectedStatus);
          expect(eventsRepo.create).not.toHaveBeenCalled();
          expect(result).toBe(updatedParcel);
        },
      );

      it('propagates InvalidStatusTransitionError when transition is invalid', async () => {
        parcelsService.findParcelById.mockResolvedValue(makeParcel({ status: 'registered' }));
        parcelsService.updateStatus.mockRejectedValue(
          new InvalidStatusTransitionError('registered', 'out_for_delivery'),
        );

        await expect(
          service.logEvent({ parcel_id: 'parcel-uuid-1', event_type: 'out_for_delivery' }),
        ).rejects.toThrow(InvalidStatusTransitionError);
      });

      it('rejects delivered event on registered parcel — confirms single-source-of-truth wiring', async () => {
        parcelsService.findParcelById.mockResolvedValue(makeParcel({ status: 'registered' }));
        parcelsService.updateStatus.mockRejectedValue(
          new InvalidStatusTransitionError('registered', 'delivered'),
        );

        await expect(
          service.logEvent({ parcel_id: 'parcel-uuid-1', event_type: 'delivered' }),
        ).rejects.toThrow(InvalidStatusTransitionError);

        expect(parcelsService.updateStatus).toHaveBeenCalledWith('parcel-uuid-1', 'delivered');
        expect(eventsRepo.create).not.toHaveBeenCalled();
      });
    });

    describe('non-status events', () => {
      it('logs requeued event directly via events repository without touching parcel status', async () => {
        const parcel = makeParcel();
        parcelsService.findParcelById.mockResolvedValue(parcel);
        eventsRepo.create.mockResolvedValue(makeEvent({ eventType: 'requeued' }));

        const result = await service.logEvent({ parcel_id: 'parcel-uuid-1', event_type: 'requeued' });

        expect(eventsRepo.create).toHaveBeenCalledWith('parcel-uuid-1', 'requeued', undefined, undefined);
        expect(parcelsService.updateStatus).not.toHaveBeenCalled();
        expect(result).toBe(parcel);
      });

      it('passes notes through to the events repository', async () => {
        parcelsService.findParcelById.mockResolvedValue(makeParcel());
        eventsRepo.create.mockResolvedValue(makeEvent());

        await service.logEvent({
          parcel_id: 'parcel-uuid-1',
          event_type: 'requeued',
          notes: 'Parcel requeued due to address error',
        });

        expect(eventsRepo.create).toHaveBeenCalledWith(
          'parcel-uuid-1',
          'requeued',
          'Parcel requeued due to address error',
          undefined,
        );
      });

      it('parses occurred_at ISO string into a Date before passing to the repository', async () => {
        parcelsService.findParcelById.mockResolvedValue(makeParcel());
        eventsRepo.create.mockResolvedValue(makeEvent());
        const isoString = '2026-01-15T10:30:00.000Z';

        await service.logEvent({
          parcel_id: 'parcel-uuid-1',
          event_type: 'requeued',
          occurred_at: isoString,
        });

        expect(eventsRepo.create).toHaveBeenCalledWith(
          'parcel-uuid-1',
          'requeued',
          undefined,
          new Date(isoString),
        );
      });
    });

    it('throws ResourceNotFoundError when parcel does not exist', async () => {
      parcelsService.findParcelById.mockRejectedValue(
        new ResourceNotFoundError('Parcel', 'bad-parcel'),
      );

      await expect(
        service.logEvent({ parcel_id: 'bad-parcel', event_type: 'picked_up' }),
      ).rejects.toThrow(ResourceNotFoundError);

      expect(parcelsService.updateStatus).not.toHaveBeenCalled();
      expect(eventsRepo.create).not.toHaveBeenCalled();
    });
  });

  // ── getTimeline ───────────────────────────────────────────────────────────────

  describe('getTimeline', () => {
    it('returns events in chronological order from the repository', async () => {
      const events: DeliveryEvent[] = [
        makeEvent({ id: 'e1', eventType: 'registered', occurredAt: new Date('2026-01-01T09:00:00Z') }),
        makeEvent({ id: 'e2', eventType: 'picked_up', occurredAt: new Date('2026-01-01T10:00:00Z') }),
        makeEvent({ id: 'e3', eventType: 'out_for_delivery', occurredAt: new Date('2026-01-01T11:00:00Z') }),
      ];
      parcelsService.findParcelById.mockResolvedValue(makeParcel());
      eventsRepo.findByParcelId.mockResolvedValue(events);

      const result = await service.getTimeline('parcel-uuid-1');

      expect(parcelsService.findParcelById).toHaveBeenCalledWith('parcel-uuid-1');
      expect(eventsRepo.findByParcelId).toHaveBeenCalledWith('parcel-uuid-1');
      expect(result).toBe(events);
      expect(result[0].eventType).toBe('registered');
      expect(result[1].eventType).toBe('picked_up');
      expect(result[2].eventType).toBe('out_for_delivery');
    });

    it('returns an empty array when parcel has no events yet', async () => {
      parcelsService.findParcelById.mockResolvedValue(makeParcel());
      eventsRepo.findByParcelId.mockResolvedValue([]);

      const result = await service.getTimeline('parcel-uuid-1');

      expect(result).toHaveLength(0);
    });

    it('throws ResourceNotFoundError when parcel does not exist', async () => {
      parcelsService.findParcelById.mockRejectedValue(
        new ResourceNotFoundError('Parcel', 'bad-parcel'),
      );

      await expect(service.getTimeline('bad-parcel')).rejects.toThrow(ResourceNotFoundError);
      expect(eventsRepo.findByParcelId).not.toHaveBeenCalled();
    });
  });
});
