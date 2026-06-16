import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  AssignParcelBodyDto,
  AssignParcelBodySchema,
  CreateAgentDto,
  CreateAgentSchema,
  UpdateAvailabilityDto,
  UpdateAvailabilitySchema,
} from './dto/agent.schemas';
import { AgentsService } from './agents.service';

@Controller('agents')
export class AgentsController {
  constructor(private readonly service: AgentsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body(new ZodValidationPipe(CreateAgentSchema)) dto: CreateAgentDto) {
    return this.service.createAgent(dto);
  }

  @Patch(':id/availability')
  setAvailability(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateAvailabilitySchema)) dto: UpdateAvailabilityDto,
  ) {
    return this.service.setAvailability(id, dto.is_available);
  }

  @Post(':id/assign')
  assignParcel(
    @Param('id') agentId: string,
    @Body(new ZodValidationPipe(AssignParcelBodySchema)) dto: AssignParcelBodyDto,
  ) {
    return this.service.assignParcel(agentId, dto.parcel_id);
  }

  @Get(':id/deliveries')
  getActiveDeliveries(@Param('id') id: string) {
    return this.service.getActiveDeliveries(id);
  }
}
