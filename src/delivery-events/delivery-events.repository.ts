import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE_TOKEN, DrizzleDB } from '../db/drizzle.provider';
import * as schema from '../db/schema';
import { DeliveryEvent, DeliveryEventType } from '../parcels/parcels.repository';

export interface IDeliveryEventsRepository {
  create(parcelId: string, eventType: DeliveryEventType, notes?: string, occurredAt?: Date): Promise<DeliveryEvent>;
  findByParcelId(parcelId: string): Promise<DeliveryEvent[]>;
}

export const DELIVERY_EVENTS_REPOSITORY = 'DELIVERY_EVENTS_REPOSITORY';

@Injectable()
export class DrizzleDeliveryEventsRepository implements IDeliveryEventsRepository {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDB) {}

  async create(
    parcelId: string,
    eventType: DeliveryEventType,
    notes?: string,
    occurredAt?: Date,
  ): Promise<DeliveryEvent> {
    const [event] = await this.db
      .insert(schema.deliveryEvents)
      .values({ parcelId, eventType, notes, occurredAt: occurredAt ?? new Date() })
      .returning();
    return event;
  }

  async findByParcelId(parcelId: string): Promise<DeliveryEvent[]> {
    return this.db
      .select()
      .from(schema.deliveryEvents)
      .where(eq(schema.deliveryEvents.parcelId, parcelId))
      .orderBy(schema.deliveryEvents.occurredAt);
  }
}
