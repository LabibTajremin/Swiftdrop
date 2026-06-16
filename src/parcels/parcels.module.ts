import { Module } from '@nestjs/common';
import { DrizzleParcelsRepository, PARCELS_REPOSITORY } from './parcels.repository';
import { ParcelsService } from './parcels.service';
import { ParcelsController } from './parcels.controller';

@Module({
  providers: [
    {
      provide: PARCELS_REPOSITORY,
      useClass: DrizzleParcelsRepository,
    },
    ParcelsService,
  ],
  controllers: [ParcelsController],
  exports: [ParcelsService, PARCELS_REPOSITORY],
})
export class ParcelsModule {}
