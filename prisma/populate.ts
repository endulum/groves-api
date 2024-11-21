import * as queries from './queries';
import * as fakes from './fakes';

export async function populate(
  opts: {
    userCount?: number;
    commCount?: number;
    postCount?: number;
    replies?: {
      min?: number;
      max: number;
      nest?: {
        roots: number;
        min?: number;
        max: number;
      };
    };
    votes?: {
      min?: number;
      max: number;
    };
    mods?: {
      min?: number;
      max: number;
    };
    followers?: {
      min?: number;
      max: number;
    };
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

  if (opts.userCount && opts.userCount > 0) {
    log(`creating ${opts.userCount} dummy user accounts`);
    userIds.push(
      ...(await queries.createBulkUsers(fakes.bulkUsers(opts.userCount))),
    );
  }

  if (opts.commCount && opts.commCount > 0) {
    log(`creating ${opts.commCount} dummy communities`);
    commIds.push(
      ...(await queries.createBulkCommunities(
        fakes.bulkCommunities(opts.commCount),
        1,
      )),
    );
  }

  if (opts.postCount && opts.postCount > 0) {
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

  if (opts.replies) {
    log(`distributing replies randomly across posts`);
    const { max, min } = opts.replies;
    await Promise.all(
      postIds.map(async (postId) => {
        const totalReplies =
          (min ?? 0) + Math.floor(Math.random() * (max - (min ?? 0)));
        // first, make the replies in the database
        const currentReplies = await queries.createBulkReplies(
          fakes.bulkReplies(totalReplies),
          commIds,
          postId,
          userIds,
        );
        replyIds.push(...currentReplies);
        // then, build the tree
        if (opts.replies!.nest) {
          const { roots, max: nestMax, min: nestMin } = opts.replies!.nest;
          let amountToTake = roots;
          let baseNodes = currentReplies.splice(0, amountToTake);
          while (currentReplies.length > 0) {
            amountToTake = (nestMin ?? 0) + Math.ceil(Math.random() * nestMax);
            const nextNodes = currentReplies.splice(0, amountToTake);
            await Promise.all(
              nextNodes.map(async (id) => {
                // connect this node's id to a random id in baseNodes
                await queries.connectReply(
                  baseNodes[Math.floor(Math.random() * baseNodes.length)],
                  id,
                );
              }),
            );
            baseNodes = nextNodes;
          }
        }
      }),
    );
    log(`${replyIds.length} total replies created`);
  }

  if (opts.votes) {
    log(`distributing votes randomly across posts`);
    const { max, min } = opts.votes;
    await Promise.all(
      postIds.map(async (post, index) => {
        // switch (index) {
        //   case 0:
        //     break;
        //   case 1:
        //     await queries.distributeVotes(post, [userIds[0]], []);
        //     break;
        //   case 2:
        //     await queries.distributeVotes(post, [], [userIds[0]]);
        //     break;
        //   default: {
        const totalVotes =
          (min ?? 0) + Math.floor(Math.random() * (max - (min ?? 0)));
        const votingUsers = [...userIds]
          .sort(() => 0.5 - Math.random())
          .slice(0, Math.floor(Math.random() * totalVotes));
        const middle = Math.floor(Math.random() * votingUsers.length);
        const upvoters = votingUsers.slice(0, middle);
        const downvoters = votingUsers.slice(middle + 1, votingUsers.length);
        await queries.distributeVotes(post, upvoters, downvoters);
        //   }
        // }
      }),
    );
  }

  if (opts.mods) {
    log(`randomly distributing moderators to communities`);
    const { max, min } = opts.mods;
    await Promise.all(
      commIds.map(async (commId) => {
        const totalMods =
          (min ?? 0) + Math.floor(Math.random() * (max - (min ?? 0)));
        await queries.distributeCommModerators(
          commId,
          [...userIds]
            .sort(() => 0.5 - Math.random())
            .slice(0, Math.ceil(Math.random() * totalMods)),
        );
      }),
    );
  }

  if (opts.followers) {
    log(`randomly distributing followers to communities`);
    const { max, min } = opts.followers;
    await Promise.all(
      commIds.map(async (commId) => {
        const totalFollowers =
          (min ?? 0) + Math.floor(Math.random() * (max - (min ?? 0)));
        await queries.distributeCommFollowers(
          commId,
          [...userIds]
            .sort(() => 0.5 - Math.random())
            .slice(0, Math.ceil(Math.random() * totalFollowers)),
        );
      }),
    );
  }

  return { userIds, commIds, postIds, replyIds };
}
