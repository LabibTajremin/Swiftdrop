import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ResourceNotFoundError } from '../common/exceptions/resource-not-found.error';
import { InvalidStatusTransitionError } from '../common/exceptions/invalid-status-transition.error';
import { AgentsService } from '../agents/agents.service';
import { CreateParcelDto, ListParcelsQueryDto } from './dto/parcel.schemas';
import {
  DeliveryEvent,
  DeliveryEventType,
  IParcelsRepository,
  Parcel,
  PARCELS_REPOSITORY,
} from './parcels.repository';
import { ParcelStatus, assertValidTransition } from './status-machine';

const STATUS_TO_EVENT: Record<ParcelStatus, DeliveryEventType> = {
  registered: 'registered',
  picked_up: 'picked_up',
  out_for_delivery: 'out_for_delivery',
  delivered: 'delivered',
  failed: 'failed_attempt',
};

@Injectable()
export class ParcelsService {
  constructor(
    @Inject(PARCELS_REPOSITORY) private readonly repo: IParcelsRepository,
    @Inject(forwardRef(() => AgentsService)) private readonly agentsService: AgentsService,
  ) {}

  async registerParcel(dto: CreateParcelDto): Promise<Parcel> {
    const parcel = await this.repo.create(dto);
    await this.repo.logEvent(parcel.id, 'registered');
    return parcel;
  }

  async updateStatus(id: string, newStatus: ParcelStatus): Promise<Parcel> {
    const parcel = await this.repo.findById(id);
    if (!parcel) throw new ResourceNotFoundError('Parcel', id);

    assertValidTransition(parcel.status, newStatus);

    const updated = await this.repo.updateStatus(id, newStatus);
    await this.repo.logEvent(id, STATUS_TO_EVENT[newStatus]);
    return updated;
  }

  async getTrackingHistory(id: string): Promise<DeliveryEvent[]> {
    const parcel = await this.repo.findById(id);
    if (!parcel) throw new ResourceNotFoundError('Parcel', id);
    return this.repo.getHistory(id);
  }

  async listParcels(
    filters: ListParcelsQueryDto,
  ): Promise<{ data: Parcel[]; total: number; page: number; limit: number }> {
    const { data, total } = await this.repo.findAll(filters);
    return { data, total, page: filters.page, limit: filters.limit };
  }

  async retryParcel(id: string, agentId?: string): Promise<Parcel> {
    const parcel = await this.repo.findById(id);
    if (!parcel) throw new ResourceNotFoundError('Parcel', id);
    if (parcel.status !== 'failed') {
      throw new InvalidStatusTransitionError(parcel.status, 'picked_up');
    }

    if (agentId !== undefined) {
      // #region cross-service: AgentsService
      await this.agentsService.validateAvailableAgent(agentId);
      // #endregion
      await this.repo.assignAgent(id, agentId);
    }

    await this.repo.logEvent(id, 'requeued');
    const updated = await this.repo.updateStatus(id, 'picked_up');
    await this.repo.logEvent(id, 'picked_up');
    return updated;
  }

  // #region Service-to-service – surface exposed for AgentsService
  // These thin methods are the only entry points another service may use to
  // read or write parcel data. In a future microservice split each becomes an
  // HTTP / message-broker call to the Parcels service.

  async findParcelById(id: string): Promise<Parcel> {
    const parcel = await this.repo.findById(id);
    if (!parcel) throw new ResourceNotFoundError('Parcel', id);
    return parcel;
  }

  async assignAgentToParcel(parcelId: string, agentId: string): Promise<Parcel> {
    return this.repo.assignAgent(parcelId, agentId);
  }

  // #endregion
}
