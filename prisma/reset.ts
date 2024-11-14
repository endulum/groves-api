import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import * as helpers from '../src/test_helpers/helpers';

dotenv.config({ path: `.env.${process.env.ENV}` });

const prisma = new PrismaClient({
  log: ['query'],
  datasources: { db: { url: process.env.DATABASE_URL } },
});

async function generateContent() {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(
    process.env.DUMMY_PASS as string,
    salt,
  );
  await helpers.createUsers([]);

  const users = await helpers.generateDummyUsers(500);
  await prisma.user.createMany({
    data: users.map((user) => ({
      username: user.username,
      password: hashedPassword,
    })),
  });

  const communities = await helpers.generateDummyCommunities(30);
  await prisma.community.createMany({
    data: communities.map((community) => ({
      urlName: community.urlName,
      canonicalName: community.canonicalName,
      description: `For fans of ${community.canonicalName}`,
      adminId: 1,
    })),
  });

  await Promise.all(communities.map(async (community) => {
    await prisma.community.update({
      where: { urlName: community.urlName },
      data: {
        followers: {
          connect: [...users]
            .sort(() => 0.5 - Math.random())
            .slice(0, Math.ceil(Math.random() * 500))
            .map((user) => ({ id: user.id })),
        },
        moderators: {
          connect: [...users]
            .sort(() => 0.5 - Math.random())
            .slice(0, Math.ceil(Math.random() * 10))
            .map((user) => ({ id: user.id })),
        },
      },
    });
  }));
}

async function main() {
  await helpers.wipeTables(['user', 'community']);
  await generateContent();
}

main()
  .catch((e) => {
    console.error(e.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
