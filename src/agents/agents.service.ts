import { Inject, Injectable } from '@nestjs/common';
import { ConstraintViolationError } from '../common/exceptions/constraint-violation.error';
import { ResourceNotFoundError } from '../common/exceptions/resource-not-found.error';
import { IParcelsRepository, Parcel, PARCELS_REPOSITORY } from '../parcels/parcels.repository';
import { CreateAgentDto } from './dto/agent.schemas';
import { Agent, AGENTS_REPOSITORY, IAgentsRepository } from './agents.repository';

/**
 * Parcel assignment has two prerequisites:
 *
 * 1. Agent must be available (`is_available = true`).
 *    Dispatching to an off-duty agent would break delivery SLAs.
 *
 * 2. Parcel must be in `registered` status.
 *    Once pickup is underway the event trail is tied to the current agent;
 *    reassigning mid-transit would leave an inconsistent history.
 */
@Injectable()
export class AgentsService {
  constructor(
    @Inject(AGENTS_REPOSITORY) private readonly agentRepo: IAgentsRepository,
    @Inject(PARCELS_REPOSITORY) private readonly parcelsRepo: IParcelsRepository,
  ) {}

  async createAgent(dto: CreateAgentDto): Promise<Agent> {
    return this.agentRepo.create(dto);
  }

  async setAvailability(id: string, isAvailable: boolean): Promise<Agent> {
    return this.agentRepo.setAvailability(id, isAvailable);
  }

  async assignParcel(agentId: string, parcelId: string): Promise<Parcel> {
    const agent = await this.agentRepo.findById(agentId);
    if (!agent) throw new ResourceNotFoundError('Agent', agentId);
    if (!agent.isAvailable) {
      throw new ConstraintViolationError('Agent is not available for assignment');
    }

    const parcel = await this.parcelsRepo.findById(parcelId);
    if (!parcel) throw new ResourceNotFoundError('Parcel', parcelId);
    if (parcel.status !== 'registered') {
      throw new ConstraintViolationError(
        `Parcel must be in 'registered' status to be assigned (current: '${parcel.status}')`,
      );
    }

    return this.parcelsRepo.assignAgent(parcelId, agentId);
  }

  async getActiveDeliveries(agentId: string): Promise<Parcel[]> {
    const agent = await this.agentRepo.findById(agentId);
    if (!agent) throw new ResourceNotFoundError('Agent', agentId);
    return this.agentRepo.findActiveDeliveries(agentId);
  }
}
