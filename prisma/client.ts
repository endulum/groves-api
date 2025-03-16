import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: `.env.${process.env.NODE_ENV}` });

const client = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

client.$connect();

export { client };
