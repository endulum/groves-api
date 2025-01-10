/* eslint-disable no-console */
import { client } from './client';
import { seed } from './seed';

async function main() {
  await seed({
    logging: true,
    userCount: 100,
    comms: {
      count: 10,
      followers: { max: 100 },
      mods: { max: 10 },
    },
    posts: {
      perComm: { max: 50 },
      votesPer: { max: 100 },
    },
    replies: {
      perPost: { max: 50 },
      votesPer: { max: 100 },
    },
  });
}

main()
  .catch((e) => {
    console.error(e.message);
  })
  .finally(async () => {
    await client.$disconnect();
  });
