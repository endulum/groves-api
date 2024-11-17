/* eslint-disable no-console */
import { client } from './client';
import { populate } from './populate';

async function main() {
  await populate(
    {
      userCount: 500,
      commCount: 150,
      maxMods: 5,
      maxFollowers: 250,
    },
    true,
  );
}

main()
  .catch((e) => {
    console.error(e.message);
  })
  .finally(async () => {
    await client.$disconnect();
  });
