import { Controller, Get, Param } from '@nestjs/common';
import { ReportingService } from './reporting.service';

@Controller('reports')
export class ReportingController {
  constructor(private readonly service: ReportingService) {}

  @Get('agents/:id')
  getAgentSummary(@Param('id') id: string) {
    return this.service.getAgentSummary(id);
  }
}
