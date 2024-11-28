/* eslint-disable @typescript-eslint/no-explicit-any */
import { client } from '../prisma/client';
import * as devQueries from '../prisma/queries/dev';
import * as helpers from './helpers';
import { seed } from '../prisma/seed';

async function generateRepliesEvenly(opts: {
  postId: string;
  levels: number;
  repliesPerLevel: number;
  repliesFirstLevel?: number;
  callbackToRepliesPerLevel?: (repliesPerLevel: number) => number;
}) {
  await devQueries.truncateTable('Reply');
  let repliesPerLevel = opts.repliesPerLevel;
  let steps = opts.levels;
  const queue: Array<null | string> = [null];
  const replyIds: string[] = [];
  while (steps > -1) {
    const thisLevelReplyIds: string[] = [];
    const thisLevelReplyCount =
      steps === opts.levels && opts.repliesFirstLevel !== undefined
        ? opts.repliesFirstLevel
        : repliesPerLevel;
    while (queue.length > 0) {
      const parentId = queue.pop();
      for (let i = 0; i < thisLevelReplyCount; i++) {
        const reply = await client.reply.create({
          data: {
            parentId,
            postId: opts.postId,
            authorId: 1,
            content: 'Lorem ipsum dolor sit amet...',
          },
        });
        thisLevelReplyIds.push(reply.id);
        replyIds.push(reply.id);
      }
    }
    queue.push(...thisLevelReplyIds);
    if (opts.callbackToRepliesPerLevel)
      repliesPerLevel = opts.callbackToRepliesPerLevel(repliesPerLevel);
    steps--;
  }
  return replyIds;
}

const checkChildOverflow = (children: any, callback?: (child: any) => void) => {
  children.forEach((child: any) => {
    if (callback) callback(child);
    if ('children' in child) {
      if (child.children.length < child.totalChildCount)
        expect(child).toHaveProperty('loadMoreChildren');
      else expect(child).not.toHaveProperty('loadMoreChildren');
      checkChildOverflow(child.children, callback);
    } else {
      if (child.totalChildCount > 0)
        expect(child).toHaveProperty('loadChildren');
      else expect(child).not.toHaveProperty('loadChildren');
    }
  });
};

const gatherChildrenIds = (children: any): string[] => {
  const ids: string[] = [];
  children.forEach((child: any) => {
    ids.push(child.id);
    if ('children' in child) {
      ids.push(...gatherChildrenIds(child.children));
    }
  });
  return ids;
};

describe('gets a tree of replies', () => {
  const userCount = 10;
  let users: number[] = [];
  let postId: string = '';
  let replyIds: string[] = [];

  beforeAll(async () => {
    const { userIds, postIds } = await seed({
      logging: false,
      userCount,
      comms: { count: 1 },
      posts: { perComm: { min: 1, max: 1 } },
    });
    users = userIds;
    postId = postIds[0];
    // create an even tree of replies for one post that goes four levels deep and has four replies per level
    // 4 + 4^2 + 4^3 + 4^4 + 4^5 = 1364 replies on this post
    replyIds = await generateRepliesEvenly({
      postId,
      levels: 4,
      repliesPerLevel: 4,
    });
  });

  test('GET /post/:post/replies - default params, correct properties shown', async () => {
    const response = await helpers.req('GET', `/post/${postId}/replies`);
    helpers.check(response, 200);
    // console.dir(response.body, { depth: null });

    // without params, the reply tree query goes three levels deep and shows three replies per level
    // 3 + 3^2 + 3^3 + 3^4 = 120 replies shown
    const ids = gatherChildrenIds(response.body.children);
    expect(ids.length).toBe(120);
    expect(new Set(ids).size).toBe(ids.length); // all unique
    checkChildOverflow(response.body.children);
  });

  test('GET /post/:post/replies - different take and levels params', async () => {
    const response = await helpers.req(
      'GET',
      `/post/${postId}/replies?levels=4&takePerLevel=4`,
    );
    helpers.check(response, 200);
    // 4 + 4^2 + 4^3 + 4^4 = all 1364 replies shown
    const ids = gatherChildrenIds(response.body.children);
    expect(ids.length).toBe(1364);
    expect(new Set(ids).size).toBe(ids.length); // all unique
    checkChildOverflow(response.body.children);
  });

  test('GET /reply/:reply - use a cursor from root request to show children', async () => {
    let response = await helpers.req('GET', `/post/${postId}/replies`);
    helpers.check(response, 200);
    const ids = gatherChildrenIds(response.body.children);
    const loadChildrenLink =
      response.body.children[0].children[0].children[0].children[0]
        .loadChildren;
    response = await helpers.req('GET', loadChildrenLink);
    helpers.check(response, 200);
    // none of the children rendered should be in ids
    response.body.children.forEach((child: any) => {
      expect(ids.find((id) => id === child.id)).toBeFalsy();
    });
    checkChildOverflow(response.body.children);
  });

  test('GET /reply/:reply - use a cursor from root request to show more children', async () => {
    let response = await helpers.req('GET', `/post/${postId}/replies`);
    helpers.check(response, 200);
    const ids = gatherChildrenIds(response.body.children);

    // target the first comment in the second layer
    const target = response.body.children[0].children[0].children[0];
    // console.dir(target, { depth: null });
    const targetIds = gatherChildrenIds(target.children);

    const loadMoreChildrenLink = target.loadMoreChildren;
    response = await helpers.req('GET', loadMoreChildrenLink + '&levels=0'); // we'll only check 0th level here
    helpers.check(response, 200);
    // console.dir(response.body, { depth: null });
    const foundIds = gatherChildrenIds(response.body.children);
    expect(foundIds.length + targetIds.length).toBe(target.totalChildCount);

    // these found ids shouldn't have already been found
    foundIds.forEach((child: any) => {
      expect(targetIds.find((id) => id === child)).toBeFalsy();
    });
    foundIds.forEach((child: any) => {
      expect(ids.find((id) => id === child)).toBeFalsy();
    });
  });

  test('GET /post/:post/replies - uses and maintains sort query', async () => {
    await Promise.all(
      replyIds.map(async (id) => {
        const totalVotes = Math.floor(Math.random() * userCount);
        const votingUsers = [...users]
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

    const response = await helpers.req(
      'GET',
      `/post/${postId}/replies?sort=top`,
    );
    helpers.check(response, 200);
    checkChildOverflow(response.body.children, (child) => {
      if (child.loadChildren)
        expect(child.loadChildren.endsWith('?sort=top')).toBeTruthy();
      if (child.loadMoreChildren)
        expect(child.loadMoreChildren.endsWith('&sort=top')).toBeTruthy();
      if ('children' in child) {
        expect(
          [...child.children]
            .map((c: { votes: { upvotes: number; downvotes: number } }) => ({
              upvotes: c.votes.upvotes,
              downvotes: c.votes.downvotes,
            }))
            .sort(
              (reply_a, reply_b) =>
                helpers.scores.top(reply_b.upvotes, reply_b.downvotes) -
                helpers.scores.top(reply_a.upvotes, reply_a.downvotes),
            ),
        ).toEqual(
          child.children.map(
            (c: { votes: { upvotes: number; downvotes: number } }) => ({
              upvotes: c.votes.upvotes,
              downvotes: c.votes.downvotes,
            }),
          ),
        );
      }
    });
  });

  test("GET /post/:post/replies - reflects auth user's vote if present", async () => {
    // without auth user
    let response = await helpers.req('GET', `/post/${postId}/replies`);
    helpers.check(response, 200);
    checkChildOverflow(response.body.children, (child) => {
      expect(child.votes.youVoted).toBeNull();
    });
    // with auth user
    const targetUserToken = await helpers.getToken(users[0]);
    response = await helpers.req(
      'GET',
      `/post/${postId}/replies`,
      null,
      targetUserToken,
    );
    helpers.check(response, 200);
    checkChildOverflow(response.body.children, (child) => {
      expect(child.votes.youVoted).not.toBeNull();
    });
  });
});
