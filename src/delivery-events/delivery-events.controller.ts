import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CreateEventDto, CreateEventSchema } from './dto/delivery-event.schemas';
import { DeliveryEventsService } from './delivery-events.service';

@Controller()
export class DeliveryEventsController {
  constructor(private readonly service: DeliveryEventsService) {}

  @Post('delivery-events')
  @HttpCode(HttpStatus.CREATED)
  logEvent(@Body(new ZodValidationPipe(CreateEventSchema)) dto: CreateEventDto) {
    return this.service.logEvent(dto);
  }

  @Get('parcels/:id/events')
  getTimeline(@Param('id') id: string) {
    return this.service.getTimeline(id);
  }
}
