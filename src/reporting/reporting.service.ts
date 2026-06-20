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
    const stats = await this.repo.getAgentDeliveryStats(agentId);
    const totalDeliveries = stats.deliveredCount + stats.failedCount;
    const successRate = totalDeliveries === 0 ? 0 : stats.deliveredCount / totalDeliveries;

    return {
      agent_id: agentId,
      total_deliveries: totalDeliveries,
      success_rate: successRate,
      avg_pickup_to_delivery_ms: stats.avgPickupToDeliveryMs,
    };
  }
}
