import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export const DRIZZLE_TOKEN = 'DRIZZLE_DB';

export type DrizzleDB = NodePgDatabase<typeof schema>;

export const DrizzleProvider: Provider = {
  provide: DRIZZLE_TOKEN,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): DrizzleDB => {
    const pool = new Pool({
      connectionString: configService.getOrThrow<string>('DATABASE_URL'),
    });
    return drizzle(pool, { schema });
  },
};
