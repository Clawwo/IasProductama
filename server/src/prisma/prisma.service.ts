import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from 'dotenv';
import { readFileSync } from 'fs';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    // Ensure .env is loaded when running via Nest CLI
    config();

    const url = process.env.DATABASE_URL;

    if (!url) {
      throw new Error(
        'DATABASE_URL is missing; set it in your environment or .env file',
      );
    }

    const sslCertPath =
      process.env.PGSSLROOTCERT || process.env.SSL_CERT_FILE || undefined;
    const sslMode = process.env.PGSSLMODE || 'verify-full';
    const urlObj = new URL(url);
    const host = urlObj.hostname;
    urlObj.search = '';

    const sslConfig = sslCertPath
      ? {
          ca: readFileSync(sslCertPath, 'utf8'),
          rejectUnauthorized: sslMode !== 'allow' && sslMode !== 'prefer',
          servername: host,
        }
      : undefined;

    const pool = new Pool({
      connectionString: urlObj.toString(),
      ssl: sslConfig,
    });
    super({ adapter: new PrismaPg(pool) });
  }
  async onModuleInit() {
    await this.$connect();
  }
}
