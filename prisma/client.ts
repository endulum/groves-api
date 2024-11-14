/* eslint-disable no-console */
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ path: `.env.${process.env.ENV}` });

const client = new PrismaClient({
  datasources: { db: { url: process.env.DATABASE_URL } },
  log: [{ emit: 'event', level: 'query' }],
});

client.$on('query', (e) => {
  if (process.env.ENV === 'development') {
    console.log(`Query: ${e.query}`);
    console.log(`Params: ${e.params}\n`);
  }
});

client.$connect();

export { client };
