import * as queries from './queries';
import * as fakes from './fakes';

export async function populate(
  opts: {
    userCount: number;
    commCount: number;
    postCount: number;
    maxRepliesPerPost: number;
    maxVotesPerPost: number;
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
  const postIds: string[] = [];
  const replyIds: string[] = [];

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

  if (opts.postCount > 0) {
    log(
      `creating ${opts.postCount} dummy posts and distributing them randomly`,
    );
    postIds.push(
      ...(await queries.createBulkPosts(
        fakes.bulkPosts(opts.postCount),
        commIds,
        userIds,
      )),
    );
  }

  if (opts.maxRepliesPerPost > 0) {
    log(`creating dummy replies and distributing them randomly`);
    await Promise.all(
      postIds.map(async (postId) => {
        replyIds.push(
          ...(await queries.createBulkReplies(
            fakes.bulkReplies(
              Math.floor(Math.random() * opts.maxRepliesPerPost),
            ),
            commIds,
            postId,
            userIds,
          )),
        );
      }),
    );
  }

  if (opts.maxVotesPerPost > 0) {
    log(`distributing votes randomly across posts`);
    await Promise.all(
      postIds.map(async (post, index) => {
        if (index === 0) {
          await queries.distributeVotes(post, [userIds[0]], []);
        } else if (index === 1) {
          await queries.distributeVotes(post, [], [userIds[0]]);
        } else {
          const votingUsers = userIds.slice(
            0,
            Math.floor(Math.random() * userIds.length),
          );
          const middle = Math.floor(Math.random() * votingUsers.length);
          const upvoters = votingUsers.slice(0, middle);
          const downvoters = votingUsers.slice(middle + 1, votingUsers.length);
          await queries.distributeVotes(post, upvoters, downvoters);
        }
      }),
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
