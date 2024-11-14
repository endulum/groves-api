/* eslint-disable no-console */
import { client } from './client';
import * as queries from './queries';
import * as fakes from './fakes';

const userCount = 300;
const userIds: number[] = [];
const commCount = 30;
const commIds: number[] = [];

const distributeMods = true;
const maxMods = 5;
const distributeFollowers = true;
const maxFollowers = 150;

async function main() {
  console.log('truncating tables');
  await queries.truncateTable('User');

  console.log('creating admin account');
  await queries.createAdmin();

  if (userCount > 0) {
    console.log(`creating ${userCount} dummy user accounts`);
    userIds.push(
      ...(await queries.createBulkUsers(fakes.bulkUsers(userCount))),
    );
  }

  if (commCount > 0) {
    console.log(`creating ${commCount} dummy communities`);
    commIds.push(
      ...(await queries.createBulkCommunities(
        fakes.bulkCommunities(commCount),
        1,
      )),
    );
  }

  if (distributeMods && userCount > 0 && commCount > 0) {
    console.log(`randomly distributing moderators to communities`);
    await Promise.all(
      commIds.map(async (commId) => {
        await queries.distributeCommModerators(
          commId,
          [...userIds]
            .sort(() => 0.5 - Math.random())
            .slice(0, Math.ceil(Math.random() * maxMods)),
        );
      }),
    );
  }

  if (distributeFollowers && userCount > 0 && commCount > 0) {
    console.log(`randomly distributing followers to communities`);
    await Promise.all(
      commIds.map(async (commId) => {
        await queries.distributeCommFollowers(
          commId,
          [...userIds]
            .sort(() => 0.5 - Math.random())
            .slice(0, Math.ceil(Math.random() * maxFollowers)),
        );
      }),
    );
  }
}

main()
  .catch((e) => {
    console.error(e.message);
  })
  .finally(async () => {
    await client.$disconnect();
  });
