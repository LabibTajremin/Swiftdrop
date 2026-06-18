import { Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundError } from '../common/exceptions/resource-not-found.error';
import {
  DeliveryEvent,
  DeliveryEventType,
  IParcelsRepository,
  Parcel,
  PARCELS_REPOSITORY,
} from '../parcels/parcels.repository';
import { ParcelsService } from '../parcels/parcels.service';
import { ParcelStatus } from '../parcels/status-machine';
import { CreateEventDto } from './dto/delivery-event.schemas';
import { DELIVERY_EVENTS_REPOSITORY, IDeliveryEventsRepository } from './delivery-events.repository';

// Only these event types imply a parcel status change; the rest are informational.
const EVENT_TO_STATUS: Partial<Record<DeliveryEventType, ParcelStatus>> = {
  picked_up: 'picked_up',
  out_for_delivery: 'out_for_delivery',
  delivered: 'delivered',
  failed_attempt: 'failed',
};

@Injectable()
export class DeliveryEventsService {
  constructor(
    @Inject(DELIVERY_EVENTS_REPOSITORY) private readonly repo: IDeliveryEventsRepository,
    private readonly parcelsService: ParcelsService,
    @Inject(PARCELS_REPOSITORY) private readonly parcelsRepo: IParcelsRepository,
  ) {}

  async logEvent(dto: CreateEventDto): Promise<Parcel> {
    const parcel = await this.parcelsRepo.findById(dto.parcel_id);
    if (!parcel) throw new ResourceNotFoundError('Parcel', dto.parcel_id);

    const targetStatus = EVENT_TO_STATUS[dto.event_type];
    if (targetStatus) {
      // Route through ParcelsService so transition validation is never bypassed.
      return this.parcelsService.updateStatus(dto.parcel_id, targetStatus);
    }

    const occurredAt = dto.occurred_at ? new Date(dto.occurred_at) : undefined;
    await this.repo.create(dto.parcel_id, dto.event_type, dto.notes, occurredAt);
    return parcel;
  }

  async getTimeline(parcelId: string): Promise<DeliveryEvent[]> {
    const parcel = await this.parcelsRepo.findById(parcelId);
    if (!parcel) throw new ResourceNotFoundError('Parcel', parcelId);
    return this.repo.findByParcelId(parcelId);
  }
}
