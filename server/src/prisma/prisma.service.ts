import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { config } from 'dotenv';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  private retryCount = 0;
  private maxRetries = 3;

  constructor() {
    // Ensure .env is loaded when running via Nest CLI
    config();

    let url = process.env.DATABASE_URL;

    if (!url) {
      throw new Error(
        'DATABASE_URL is missing; set it in your environment or .env file',
      );
    }

    // Add statement timeout to connection string if not already present
    if (!url.includes('statement_timeout')) {
      url += (url.includes('?') ? '&' : '?') + 'statement_timeout=120000';
    }

    const pool = new Pool({
      connectionString: url,
      max: 50, // Significantly increased to handle concurrent transactions
      min: 10, // Keep more idle connections ready
      idleTimeoutMillis: 120000, // 120 seconds
      connectionTimeoutMillis: 15000, // 15 seconds to establish connection
    });

    // Add error handler to log pool issues
    pool.on('error', (err) => {
      console.error('Pool error:', err.message);
    });

    super({
      adapter: new PrismaPg(pool),
    });
  }
  async onModuleInit() {
    await this.$connect();
  }
}
