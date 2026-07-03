import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    // 1. Initialize a native pg pool with your environment variable
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    // 2. Wrap the pool in Prisma's Postgres adapter
    const adapter = new PrismaPg(pool);

    // 3. Pass the adapter to the PrismaClient base class
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }
}