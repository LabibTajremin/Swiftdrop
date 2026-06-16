import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray } from 'drizzle-orm';
import { DRIZZLE_TOKEN, DrizzleDB } from '../db/drizzle.provider';
import * as schema from '../db/schema';
import { DeliveryEvent, Parcel } from '../parcels/parcels.repository';

export interface ParcelWithEvents {
  parcel: Parcel;
  events: DeliveryEvent[];
}

export interface IReportingRepository {
  getAgentDeliveryData(agentId: string): Promise<ParcelWithEvents[]>;
}

export const REPORTING_REPOSITORY = 'REPORTING_REPOSITORY';

@Injectable()
export class DrizzleReportingRepository implements IReportingRepository {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDB) {}

  async getAgentDeliveryData(agentId: string): Promise<ParcelWithEvents[]> {
    const parcels = await this.db
      .select()
      .from(schema.parcels)
      .where(
        and(
          eq(schema.parcels.assignedAgentId, agentId),
          inArray(schema.parcels.status, ['delivered', 'failed']),
        ),
      );

    if (parcels.length === 0) return [];

    const parcelIds = parcels.map((p) => p.id);
    const events = await this.db
      .select()
      .from(schema.deliveryEvents)
      .where(inArray(schema.deliveryEvents.parcelId, parcelIds))
      .orderBy(schema.deliveryEvents.occurredAt);

    const eventsByParcel = new Map<string, DeliveryEvent[]>();
    for (const event of events) {
      const list = eventsByParcel.get(event.parcelId) ?? [];
      list.push(event);
      eventsByParcel.set(event.parcelId, list);
    }

    return parcels.map((parcel) => ({
      parcel,
      events: eventsByParcel.get(parcel.id) ?? [],
    }));
  }
}
