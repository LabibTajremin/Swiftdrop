import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DrizzleModule } from './db/drizzle.module';
import { ParcelsModule } from './parcels/parcels.module';
import { AgentsModule } from './agents/agents.module';
import { DeliveryEventsModule } from './delivery-events/delivery-events.module';
import { ReportingModule } from './reporting/reporting.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    DrizzleModule,
    ParcelsModule,
    AgentsModule,
    DeliveryEventsModule,
    ReportingModule,
  ],
})
export class AppModule {}
