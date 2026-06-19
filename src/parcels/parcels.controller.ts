import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  CreateParcelDto,
  CreateParcelSchema,
  ListParcelsQueryDto,
  ListParcelsQuerySchema,
  RetryParcelDto,
  RetryParcelSchema,
  UpdateParcelStatusDto,
  UpdateParcelStatusSchema,
} from './dto/parcel.schemas';
import { ParcelsService } from './parcels.service';

@Controller('parcels')
export class ParcelsController {
  constructor(private readonly service: ParcelsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body(new ZodValidationPipe(CreateParcelSchema)) dto: CreateParcelDto) {
    return this.service.registerParcel(dto);
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(UpdateParcelStatusSchema)) dto: UpdateParcelStatusDto,
  ) {
    return this.service.updateStatus(id, dto.status);
  }

  @Get(':id/history')
  getHistory(@Param('id') id: string) {
    return this.service.getTrackingHistory(id);
  }

  @Get()
  list(@Query(new ZodValidationPipe(ListParcelsQuerySchema)) query: ListParcelsQueryDto) {
    return this.service.listParcels(query);
  }

  @Post(':id/retry')
  retry(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(RetryParcelSchema)) dto: RetryParcelDto,
  ) {
    return this.service.retryParcel(id, dto.agent_id);
  }
}
