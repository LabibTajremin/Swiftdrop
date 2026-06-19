import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConstraintViolationError } from '../common/exceptions/constraint-violation.error';
import { ResourceNotFoundError } from '../common/exceptions/resource-not-found.error';
import { Parcel } from '../parcels/parcels.repository';
import { ParcelsService } from '../parcels/parcels.service';
import { CreateAgentDto } from './dto/agent.schemas';
import { Agent, AGENTS_REPOSITORY, IAgentsRepository } from './agents.repository';

@Injectable()
export class AgentsService {
  constructor(
    @Inject(AGENTS_REPOSITORY) private readonly agentRepo: IAgentsRepository,
    @Inject(forwardRef(() => ParcelsService)) private readonly parcelsService: ParcelsService,
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

    // #region cross-service: ParcelsService
    const parcel = await this.parcelsService.findParcelById(parcelId);
    if (parcel.status !== 'registered') {
      throw new ConstraintViolationError(
        `Parcel must be in 'registered' status to be assigned (current: '${parcel.status}')`,
      );
    }
    return this.parcelsService.assignAgentToParcel(parcelId, agentId);
    // #endregion
  }

  async getActiveDeliveries(agentId: string): Promise<Parcel[]> {
    const agent = await this.agentRepo.findById(agentId);
    if (!agent) throw new ResourceNotFoundError('Agent', agentId);
    return this.agentRepo.findActiveDeliveries(agentId);
  }

  // Called by ParcelsService during retry to validate the replacement agent.
  // Kept here so all agent-availability rules stay in one place.
  async validateAvailableAgent(agentId: string): Promise<void> {
    const agent = await this.agentRepo.findById(agentId);
    if (!agent) throw new ResourceNotFoundError('Agent', agentId);
    if (!agent.isAvailable) {
      throw new ConstraintViolationError('Agent is not available for assignment');
    }
  }
}
