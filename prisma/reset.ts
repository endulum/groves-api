import { PrismaClient } from "@prisma/client";
import bcrypt from 'bcryptjs'

import dotenv from 'dotenv'
dotenv.config({ path: '.env.' + process.env.ENV })

const prisma = new PrismaClient({ 
  log: ['query'],
  datasources: { db: { url: process.env.DATABASE_URL } }
});

async function clearDatabase() {
  await prisma.user.deleteMany()
  await prisma.session.deleteMany()
}

async function generateUsers() {
  if (!process.env.ADMIN_PASS) return;
  const salt = await bcrypt.genSalt(10)
  const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASS, salt)
  await prisma.user.createMany({
    data: [
      {
        username: 'admin',
        password: hashedPassword,
        id: 1,
        role: 'ADMIN'
      }, {
        username: 'basic',
        password: hashedPassword,
        id: 2,
        role: 'BASIC'
      }
    ]
  })
}

async function main() {
  await clearDatabase()
  await generateUsers()
}

main()
  .catch(e => {
    console.error(e.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });