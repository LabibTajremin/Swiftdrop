import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, ilike } from 'drizzle-orm';
import { InferSelectModel } from 'drizzle-orm';
import { DRIZZLE_TOKEN, DrizzleDB } from '../db/drizzle.provider';
import * as schema from '../db/schema';
import { ConstraintViolationError } from '../common/exceptions/constraint-violation.error';
import { ResourceNotFoundError } from '../common/exceptions/resource-not-found.error';
import { ParcelStatus } from './status-machine';
import { CreateParcelDto, ListParcelsQueryDto } from './dto/parcel.schemas';
import { DELIVERY_EVENT_TYPES } from '../delivery-events/dto/delivery-event.schemas';

export type Parcel = InferSelectModel<typeof schema.parcels>;
export type DeliveryEvent = InferSelectModel<typeof schema.deliveryEvents>;
export type DeliveryEventType = (typeof DELIVERY_EVENT_TYPES)[number];

export interface IParcelsRepository {
  create(dto: CreateParcelDto): Promise<Parcel>;
  findById(id: string): Promise<Parcel | null>;
  findByTrackingNumber(trackingNumber: string): Promise<Parcel | null>;
  findAll(filters: ListParcelsQueryDto): Promise<{ data: Parcel[]; total: number }>;
  updateStatus(id: string, status: ParcelStatus): Promise<Parcel>;
  assignAgent(id: string, agentId: string): Promise<Parcel>;
  logEvent(parcelId: string, eventType: DeliveryEventType, notes?: string): Promise<void>;
  getHistory(parcelId: string): Promise<DeliveryEvent[]>;
}

export const PARCELS_REPOSITORY = 'PARCELS_REPOSITORY';

@Injectable()
export class DrizzleParcelsRepository implements IParcelsRepository {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDB) {}

  async create(dto: CreateParcelDto): Promise<Parcel> {
    try {
      const [parcel] = await this.db
        .insert(schema.parcels)
        .values({
          trackingNumber: dto.tracking_number,
          senderName: dto.sender_name,
          senderAddress: dto.sender_address,
          receiverName: dto.receiver_name,
          receiverAddress: dto.receiver_address,
        })
        .returning();
      return parcel;
    } catch (err) {
      if (isPgCode(err, '23505')) {
        throw new ConstraintViolationError(
          `Tracking number '${dto.tracking_number}' is already in use`,
        );
      }
      throw err;
    }
  }

  async findById(id: string): Promise<Parcel | null> {
    const [parcel] = await this.db
      .select()
      .from(schema.parcels)
      .where(eq(schema.parcels.id, id));
    return parcel ?? null;
  }

  async findByTrackingNumber(trackingNumber: string): Promise<Parcel | null> {
    const [parcel] = await this.db
      .select()
      .from(schema.parcels)
      .where(eq(schema.parcels.trackingNumber, trackingNumber));
    return parcel ?? null;
  }

  async findAll(filters: ListParcelsQueryDto): Promise<{ data: Parcel[]; total: number }> {
    const conditions = [];

    if (filters.status) {
      conditions.push(eq(schema.parcels.status, filters.status));
    }
    if (filters.agent_id) {
      conditions.push(eq(schema.parcels.assignedAgentId, filters.agent_id));
    }
    if (filters.sender_name) {
      conditions.push(ilike(schema.parcels.senderName, `%${filters.sender_name}%`));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const offset = (filters.page - 1) * filters.limit;

    const [data, [{ value: total }]] = await Promise.all([
      this.db
        .select()
        .from(schema.parcels)
        .where(where)
        .limit(filters.limit)
        .offset(offset)
        .orderBy(schema.parcels.createdAt),
      this.db.select({ value: count() }).from(schema.parcels).where(where),
    ]);

    return { data, total: Number(total) };
  }

  async updateStatus(id: string, status: ParcelStatus): Promise<Parcel> {
    const [updated] = await this.db
      .update(schema.parcels)
      .set({ status, updatedAt: new Date() })
      .where(eq(schema.parcels.id, id))
      .returning();

    if (!updated) {
      throw new ResourceNotFoundError('Parcel', id);
    }

    return updated;
  }

  async assignAgent(id: string, agentId: string): Promise<Parcel> {
    try {
      const [updated] = await this.db
        .update(schema.parcels)
        .set({ assignedAgentId: agentId, updatedAt: new Date() })
        .where(eq(schema.parcels.id, id))
        .returning();

      if (!updated) {
        throw new ResourceNotFoundError('Parcel', id);
      }

      return updated;
    } catch (err) {
      if (isPgCode(err, '23503')) {
        throw new ConstraintViolationError(`Agent with id '${agentId}' does not exist`);
      }
      throw err;
    }
  }

  async logEvent(parcelId: string, eventType: DeliveryEventType, notes?: string): Promise<void> {
    await this.db.insert(schema.deliveryEvents).values({ parcelId, eventType, notes, occurredAt: new Date() });
  }

  async getHistory(parcelId: string): Promise<DeliveryEvent[]> {
    return this.db
      .select()
      .from(schema.deliveryEvents)
      .where(eq(schema.deliveryEvents.parcelId, parcelId))
      .orderBy(schema.deliveryEvents.occurredAt);
  }
}

function isPgCode(err: unknown, code: string): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === code
  );
}
