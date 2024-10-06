/* eslint-disable no-console */

import prisma from './src/prisma';

async function main() {
  const communities = await prisma.community.findMany({
    where: { status: 'ACTIVE' },
    include: {
      _count: {
        select: {
          followers: true,
          posts: true,
        },
      },
    },
    omit: {
      id: true,
      adminId: true,
      created: true,
      wiki: true,
    },
  });

  const community = await prisma.community.findFirst({
    where: { status: 'ACTIVE' },
    include: {
      admin: {
        select: {
          id: true,
          username: true,
        },
      },
      moderators: {
        select: {
          id: true,
          username: true,
        },
      },
      followers: {
        select: {
          id: true,
          username: true,
        },
      },
    },
    omit: {
      id: true,
      adminId: true,
    },
  });

  console.dir(communities, { depth: null });
  console.dir(community, { depth: null });
}

main().catch((e) => console.error(e));
