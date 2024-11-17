import * as queries from './queries';
import * as fakes from './fakes';

export async function populate(
  opts: {
    userCount: number;
    commCount: number;
    maxMods: number;
    maxFollowers: number;
  },
  logging?: boolean,
) {
  const log = (string: string) => {
    // eslint-disable-next-line no-console
    if (logging) console.log(string);
  };

  const userIds: number[] = [];
  const commIds: number[] = [];

  log('truncating tables');
  await queries.truncateTable('User');

  log('creating admin account');
  await queries.createAdmin();

  if (opts.userCount > 0) {
    log(`creating ${opts.userCount} dummy user accounts`);
    userIds.push(
      ...(await queries.createBulkUsers(fakes.bulkUsers(opts.userCount))),
    );
  }

  if (opts.commCount > 0) {
    log(`creating ${opts.commCount} dummy communities`);
    commIds.push(
      ...(await queries.createBulkCommunities(
        fakes.bulkCommunities(opts.commCount),
        1,
      )),
    );
  }

  if (opts.maxMods > 0 && opts.userCount > 0 && opts.commCount > 0) {
    log(`randomly distributing moderators to communities`);
    await Promise.all(
      commIds.map(async (commId) => {
        await queries.distributeCommModerators(
          commId,
          [...userIds]
            .sort(() => 0.5 - Math.random())
            .slice(0, Math.ceil(Math.random() * opts.maxMods)),
        );
      }),
    );
  }

  if (opts.maxFollowers > 0 && opts.userCount > 0 && opts.commCount > 0) {
    log(`randomly distributing followers to communities`);
    await Promise.all(
      commIds.map(async (commId) => {
        await queries.distributeCommFollowers(
          commId,
          [...userIds]
            .sort(() => 0.5 - Math.random())
            .slice(0, Math.ceil(Math.random() * opts.maxFollowers)),
        );
      }),
    );
  }
}
