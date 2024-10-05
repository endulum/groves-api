import { PrismaClient } from '@prisma/client';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';

import dotenv from 'dotenv';

dotenv.config({ path: `.env.${process.env.ENV}` });

const prisma = new PrismaClient({
  log: ['query'],
  datasources: { db: { url: process.env.DATABASE_URL } },
});

const generateUsername = () => (faker.color.human().split(' ').join('-'))
  .concat('-')
  .concat(faker.animal.type().split(' ').join('-'));

async function clearDatabase() {
  await prisma.community.deleteMany();
  await prisma.user.deleteMany();
}

async function generateContent() {
  const usernames: string[] = [];
  while (usernames.length <= 50) {
    const username = generateUsername();
    if (!usernames.includes(username)) usernames.push(username);
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(process.env.DUMMY_PASS as string, salt);

  await prisma.$queryRaw`ALTER SEQUENCE "User_id_seq" RESTART WITH 11;`;

  await prisma.user.create({
    data: {
      username: 'admin',
      password: hashedPassword,
      id: 1,
      role: 'ADMIN',
    },
  });

  const users = await prisma.$transaction(
    usernames.map((username) => prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        bio: faker.person.bio(),
        role: 'BASIC',
      },
    })),
  );

  await prisma.$queryRaw`ALTER SEQUENCE "Community_id_seq" RESTART WITH 1;`;

  await Promise.all([
    {
      urlName: 'askgroves',
      canonicalName: 'Ask Groves',
      description: 'This is the place to ask and answer thought-provoking questions.',
    }, {
      urlName: 'nostupidquestions',
      canonicalName: 'No Stupid Questions',
      description: 'Ask away!',
    }, {
      urlName: 'damnthatsinteresting',
      canonicalName: 'Damn, that\'s interesting!',
      description: 'For the most interesting things on the internet',
    }, {
      urlName: 'gaming',
      canonicalName: 'Gaming',
      description: 'The number one gaming forum on the Internet.',
    }, {
      urlName: 'worldnews',
      canonicalName: 'World News',
      description: 'A place for major news from around the world',
    }, {
      urlName: 'frozen',
      canonicalName: 'Frozen',
      description: 'You shouldn\'t see this one in global search!',
    }, {
      urlName: 'hidden',
      canonicalName: 'Hidden',
      description: 'You shouldn\'t see this one!',
    },
  ].map(async (community, index) => prisma.community.create({
    data: {
      urlName: community.urlName,
      canonicalName: community.canonicalName,
      description: community.description,
      // eslint-disable-next-line no-nested-ternary
      status: index === 5 ? 'FROZEN' : index === 6 ? 'HIDDEN' : 'ACTIVE',
      adminId: 1,
      followers: {
        connect: [...users]
          .sort(() => 0.5 - Math.random())
          .slice(0, Math.ceil(Math.random() * 50))
          .map((user) => ({ id: user.id })),
      },
      moderators: {
        connect: [...users]
          .sort(() => 0.5 - Math.random())
          .slice(0, Math.ceil(Math.random() * 4))
          .map((user) => ({ id: user.id })),
      },
    },
  })));

  // const eleven = await prisma.user.findUnique(
  //   { where: { id: 11 }, include: { moderatorOf: true } },
  // );
  // console.log(eleven?.moderatorOf);
}

async function main() {
  await clearDatabase();
  await generateContent();
}

main()
  .catch((e) => {
    console.error(e.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
