import { forwardRef, Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { DrizzleParcelsRepository, PARCELS_REPOSITORY } from './parcels.repository';
import { ParcelsService } from './parcels.service';
import { ParcelsController } from './parcels.controller';

@Module({
  imports: [forwardRef(() => AgentsModule)],
  providers: [
    {
      provide: PARCELS_REPOSITORY,
      useClass: DrizzleParcelsRepository,
    },
    ParcelsService,
  ],
  controllers: [ParcelsController],
  exports: [ParcelsService],
})
export class ParcelsModule {}
