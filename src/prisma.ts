import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: `.env.${process.env.ENV}` });

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
});

prisma.$connect();

export default prisma;
