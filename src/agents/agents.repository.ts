import { Inject, Injectable } from '@nestjs/common';
import { InferSelectModel } from 'drizzle-orm';
import { and, eq, notInArray } from 'drizzle-orm';
import { DRIZZLE_TOKEN, DrizzleDB } from '../db/drizzle.provider';
import * as schema from '../db/schema';
import { ResourceNotFoundError } from '../common/exceptions/resource-not-found.error';
import { Parcel } from '../parcels/parcels.repository';
import { CreateAgentDto } from './dto/agent.schemas';

export type Agent = InferSelectModel<typeof schema.agents>;

export interface IAgentsRepository {
  create(dto: CreateAgentDto): Promise<Agent>;
  findById(id: string): Promise<Agent | null>;
  setAvailability(id: string, isAvailable: boolean): Promise<Agent>;
  findActiveDeliveries(agentId: string): Promise<Parcel[]>;
}

export const AGENTS_REPOSITORY = 'AGENTS_REPOSITORY';

@Injectable()
export class DrizzleAgentsRepository implements IAgentsRepository {
  constructor(@Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDB) {}

  async create(dto: CreateAgentDto): Promise<Agent> {
    const [agent] = await this.db
      .insert(schema.agents)
      .values({ name: dto.name, phone: dto.phone })
      .returning();
    return agent;
  }

  async findById(id: string): Promise<Agent | null> {
    const [agent] = await this.db
      .select()
      .from(schema.agents)
      .where(eq(schema.agents.id, id));
    return agent ?? null;
  }

  async setAvailability(id: string, isAvailable: boolean): Promise<Agent> {
    const [updated] = await this.db
      .update(schema.agents)
      .set({ isAvailable, updatedAt: new Date() })
      .where(eq(schema.agents.id, id))
      .returning();

    if (!updated) throw new ResourceNotFoundError('Agent', id);
    return updated;
  }

  // Returns parcels assigned to this agent that are still active
  // (i.e. status is not 'delivered' or 'failed').
  async findActiveDeliveries(agentId: string): Promise<Parcel[]> {
    return this.db
      .select()
      .from(schema.parcels)
      .where(
        and(
          eq(schema.parcels.assignedAgentId, agentId),
          notInArray(schema.parcels.status, ['delivered', 'failed']),
        ),
      )
      .orderBy(schema.parcels.createdAt);
  }
}
