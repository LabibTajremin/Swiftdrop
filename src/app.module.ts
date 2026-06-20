import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { DrizzleModule } from './db/drizzle.module';
import { ParcelsModule } from './parcels/parcels.module';
import { AgentsModule } from './agents/agents.module';
import { DeliveryEventsModule } from './delivery-events/delivery-events.module';
import { ReportingModule } from './reporting/reporting.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [{
        ttl:   config.get<number>('THROTTLE_TTL_MS')  ?? 60_000,
        limit: config.get<number>('THROTTLE_LIMIT')   ?? 100,
      }],
    }),
    DrizzleModule,
    ParcelsModule,
    AgentsModule,
    DeliveryEventsModule,
    ReportingModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
