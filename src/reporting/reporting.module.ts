import { Module } from '@nestjs/common';
import { ReportingController } from './reporting.controller';
import { DrizzleReportingRepository, REPORTING_REPOSITORY } from './reporting.repository';
import { ReportingService } from './reporting.service';

@Module({
  providers: [
    { provide: REPORTING_REPOSITORY, useClass: DrizzleReportingRepository },
    ReportingService,
  ],
  controllers: [ReportingController],
})
export class ReportingModule {}
