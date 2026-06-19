import { Inject, Injectable } from '@nestjs/common';
import {
  DeliveryEvent,
  DeliveryEventType,
  Parcel,
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
  ) {}

  async logEvent(dto: CreateEventDto): Promise<Parcel> {
    // #region cross-service: ParcelsService
    const parcel = await this.parcelsService.findParcelById(dto.parcel_id);
    // #endregion

    const targetStatus = EVENT_TO_STATUS[dto.event_type];
    if (targetStatus) {
      // #region cross-service: ParcelsService
      return this.parcelsService.updateStatus(dto.parcel_id, targetStatus);
      // #endregion
    }

    const occurredAt = dto.occurred_at ? new Date(dto.occurred_at) : undefined;
    await this.repo.create(dto.parcel_id, dto.event_type, dto.notes, occurredAt);
    return parcel;
  }

  async getTimeline(parcelId: string): Promise<DeliveryEvent[]> {
    // #region cross-service: ParcelsService
    await this.parcelsService.findParcelById(parcelId);
    // #endregion
    return this.repo.findByParcelId(parcelId);
  }
}
