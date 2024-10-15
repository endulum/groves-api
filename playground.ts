/* eslint-disable no-console */
import { faker } from '@faker-js/faker';
import prisma from './src/prisma';

const generateCommunityName = (): { canonicalName: string, urlName: string } => {
  const canonicalName = faker.food.dish();
  const urlName = (
    canonicalName.toLocaleLowerCase().split(' ').join('').match(/[a-z0-9]+/g) || []
  ).join('');

  return {
    canonicalName,
    urlName,
  };
};

async function main() {
  const communities: Array<{ canonicalName: string, urlName: string }> = [];

  while (communities.length <= 20) {
    const community = generateCommunityName();
    if (
      community.canonicalName.length <= 64
      && community.urlName.length <= 32
      && !communities.find(
        (c) => c.urlName === community.urlName,
      )
    ) {
      communities.push(community);
    }
  }

  console.log(communities);
  // const communities = await prisma.community.findMany({
  //   where: { status: 'ACTIVE' },
  //   include: {
  //     _count: {
  //       select: {
  //         followers: true,
  //         posts: true,
  //       },
  //     },
  //   },
  //   omit: {
  //     id: true,
  //     adminId: true,
  //     created: true,
  //     wiki: true,
  //   },
  // });

  // const community = await prisma.community.findFirst({
  //   where: { status: 'ACTIVE' },
  //   include: {
  //     admin: {
  //       select: {
  //         id: true,
  //         username: true,
  //       },
  //     },
  //     moderators: {
  //       select: {
  //         id: true,
  //         username: true,
  //       },
  //     },
  //     followers: {
  //       select: {
  //         id: true,
  //         username: true,
  //       },
  //     },
  //   },
  //   omit: {
  //     id: true,
  //     adminId: true,
  //   },
  // });

  // console.dir(communities, { depth: null });
  // console.dir(community, { depth: null });
}

main().catch((e) => console.error(e));
