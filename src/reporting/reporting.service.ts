import { Inject, Injectable } from '@nestjs/common';
import { IReportingRepository, REPORTING_REPOSITORY } from './reporting.repository';

export interface AgentSummary {
  agent_id: string;
  total_deliveries: number;
  success_rate: number;
  avg_pickup_to_delivery_ms: number | null;
}

@Injectable()
export class ReportingService {
  constructor(
    @Inject(REPORTING_REPOSITORY) private readonly repo: IReportingRepository,
  ) {}

  async getAgentSummary(agentId: string): Promise<AgentSummary> {
    const deliveryData = await this.repo.getAgentDeliveryData(agentId);

    const delivered = deliveryData.filter((d) => d.parcel.status === 'delivered');
    const failed = deliveryData.filter((d) => d.parcel.status === 'failed');
    const totalDeliveries = delivered.length + failed.length;

    const successRate = totalDeliveries === 0 ? 0 : delivered.length / totalDeliveries;

    const durations: number[] = [];
    for (const { events } of delivered) {
      const pickedUpEvent = events.find((e) => e.eventType === 'picked_up');
      const deliveredEvent = events.find((e) => e.eventType === 'delivered');
      if (pickedUpEvent && deliveredEvent) {
        durations.push(deliveredEvent.occurredAt.getTime() - pickedUpEvent.occurredAt.getTime());
      }
    }

    const avgPickupToDeliveryMs =
      durations.length === 0 ? null : durations.reduce((a, b) => a + b, 0) / durations.length;

    return {
      agent_id: agentId,
      total_deliveries: totalDeliveries,
      success_rate: successRate,
      avg_pickup_to_delivery_ms: avgPickupToDeliveryMs,
    };
  }
}
