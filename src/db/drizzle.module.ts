import { Global, Module } from '@nestjs/common';
import { DrizzleProvider, DRIZZLE_TOKEN } from './drizzle.provider';

@Global()
@Module({
  providers: [DrizzleProvider],
  exports: [DRIZZLE_TOKEN],
})
export class DrizzleModule {}
