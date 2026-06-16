import { Module } from '@nestjs/common';
import { ParcelsModule } from '../parcels/parcels.module';
import { DeliveryEventsController } from './delivery-events.controller';
import { DrizzleDeliveryEventsRepository, DELIVERY_EVENTS_REPOSITORY } from './delivery-events.repository';
import { DeliveryEventsService } from './delivery-events.service';

@Module({
  imports: [ParcelsModule],
  providers: [
    { provide: DELIVERY_EVENTS_REPOSITORY, useClass: DrizzleDeliveryEventsRepository },
    DeliveryEventsService,
  ],
  controllers: [DeliveryEventsController],
})
export class DeliveryEventsModule {}
