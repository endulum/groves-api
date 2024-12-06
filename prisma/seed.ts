import * as devQueries from './queries/dev';
import * as fakes from './fakes';

const rand = (max: number, min?: number) =>
  (min ?? 0) + Math.floor(Math.random() * (max - (min ?? 0)));

export async function seed(opts: {
  logging?: boolean;
  userCount?: number;

  comms?: {
    count: number;
    mods?: { min?: number; max: number };
    followers?: { min?: number; max: number };
  };

  posts?: {
    perComm: { min?: number; max: number };
    votesPer?: { min?: number; max: number };
  };

  replies?: {
    perPost: { min?: number; max: number };
    votesPer?: { min?: number; max: number };
  };
}) {
  const log = (string: string) => {
    // eslint-disable-next-line no-console
    if (opts.logging) console.log(string);
  };

  const userIds: number[] = [];
  const commIds: number[] = [];
  const postIds: string[] = [];
  const replyIds: string[] = [];

  log('truncating tables');
  await devQueries.truncateTable('User');

  log('creating admin account');
  await devQueries.createAdmin();

  if (opts.userCount && opts.userCount > 0) {
    log(`creating ${opts.userCount} dummy user accounts`);
    userIds.push(
      ...(await devQueries.createBulkUsers(fakes.bulkUsers(opts.userCount))),
    );
  }

  if (opts.comms && opts.comms.count > 0) {
    log(`creating ${opts.comms.count} dummy communities`);
    commIds.push(
      ...(await devQueries.createBulkCommunities(
        fakes.bulkCommunities(opts.comms.count),
        1,
      )),
    );

    if (opts.comms.mods) {
      log(`randomly distributing moderators to communities`);
      const { max, min } = opts.comms.mods;
      await Promise.all(
        commIds.map(async (commId) => {
          const totalMods =
            (min ?? 0) + Math.floor(Math.random() * (max - (min ?? 0)));
          await devQueries.distributeCommModerators(
            commId,
            [...userIds]
              .sort(() => 0.5 - Math.random())
              .slice(0, Math.ceil(Math.random() * totalMods)),
          );
        }),
      );
    }

    if (opts.comms.followers) {
      log(`randomly distributing followers to communities`);
      const { max, min } = opts.comms.followers;
      await Promise.all(
        commIds.map(async (commId) => {
          const totalFollowers =
            (min ?? 0) + Math.floor(Math.random() * (max - (min ?? 0)));
          await devQueries.distributeCommFollowers(
            commId,
            [...userIds]
              .sort(() => 0.5 - Math.random())
              .slice(0, Math.ceil(Math.random() * totalFollowers)),
          );
        }),
      );
    }
  }

  if (commIds.length > 0 && opts.posts) {
    const { max, min } = opts.posts.perComm;
    log(`distributing posts to communities (min: ${min ?? 0}, max: ${max})`);
    await Promise.all(
      commIds.map(async (communityId) => {
        const totalPosts = rand(max, min);
        postIds.push(
          ...(await devQueries.createBulkPosts(
            fakes.bulkPosts(totalPosts),
            communityId,
            userIds,
          )),
        );
      }),
    );
  }

  if (postIds.length > 0 && opts.posts?.votesPer) {
    const { max, min } = opts.posts.votesPer;
    log(`distributing votes to posts (min: ${min ?? 0}, max: ${max})`);
    await Promise.all(
      postIds.map(async (id) => {
        const totalVotes = rand(max, min);
        const votingUsers = [...userIds]
          .sort(() => 0.5 - Math.random())
          .slice(0, Math.floor(Math.random() * totalVotes));
        const middle = Math.floor(Math.random() * votingUsers.length);
        const upvoterIds = votingUsers.slice(0, middle);
        const downvoterIds = votingUsers.slice(middle + 1, votingUsers.length);
        await devQueries.distributeVotes({
          type: 'post',
          id,
          upvoterIds,
          downvoterIds,
        });
      }),
    );
  }

  if (postIds.length > 0 && opts.replies?.perPost) {
    const { max, min } = opts.replies.perPost;
    log(`distributing replies to posts (min: ${min ?? 0}, max: ${max})`);
    await Promise.all(
      postIds.map(async (post) => {
        const totalReplies = rand(max, min);
        replyIds.push(
          ...(await devQueries.createBulkReplies(
            fakes.bulkReplies(totalReplies),
            post,
            userIds,
          )),
        );
      }),
    );
  }

  if (replyIds.length > 0 && opts.replies?.votesPer) {
    const { max, min } = opts.replies.votesPer;
    log(`distributing votes to replies (min: ${min ?? 0}, max: ${max})`);
    await Promise.all(
      replyIds.map(async (id) => {
        const totalVotes = rand(max, min);
        const votingUsers = [...userIds]
          .sort(() => 0.5 - Math.random())
          .slice(0, Math.floor(Math.random() * totalVotes));
        const middle = Math.floor(Math.random() * votingUsers.length);
        const upvoterIds = votingUsers.slice(0, middle);
        const downvoterIds = votingUsers.slice(middle + 1, votingUsers.length);
        await devQueries.distributeVotes({
          type: 'reply',
          id,
          upvoterIds,
          downvoterIds,
        });
      }),
    );
  }

  return { userIds, commIds, postIds, replyIds };
}
