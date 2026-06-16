import { Module } from '@nestjs/common';
import { ParcelsModule } from '../parcels/parcels.module';
import { DrizzleAgentsRepository, AGENTS_REPOSITORY } from './agents.repository';
import { AgentsService } from './agents.service';
import { AgentsController } from './agents.controller';

@Module({
  imports: [ParcelsModule],
  providers: [
    {
      provide: AGENTS_REPOSITORY,
      useClass: DrizzleAgentsRepository,
    },
    AgentsService,
  ],
  controllers: [AgentsController],
})
export class AgentsModule {}
