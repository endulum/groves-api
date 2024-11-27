import * as helpers from './helpers';
import * as devQueries from '../prisma/queries/dev';
import * as userQueries from '../prisma/queries/user';
import * as commQueries from '../prisma/queries/community';
import * as postQueries from '../prisma/queries/post';
import { populate } from '../prisma/populate';
import wilson from 'wilson-score-interval';

const hotScore = (upvotes: number, downvotes: number) => {
  const order = Math.log10(Math.max(Math.abs(upvotes - downvotes), 1));
  const sign: number =
    upvotes - downvotes > 0 ? 1 : upvotes - downvotes < 0 ? -1 : 0;
  const seconds = Date.now();
  return sign * order + seconds / 100000;
};

const topScore = (upvotes: number, downvotes: number) => upvotes - downvotes;

const bestScore = (upvotes: number, downvotes: number) => {
  if (upvotes + downvotes === 0) return 0;
  return wilson(upvotes, upvotes + downvotes);
};

const controversyScore = (upvotes: number, downvotes: number) => {
  if (upvotes + downvotes === 0) return 0;
  const power = upvotes > downvotes ? downvotes / upvotes : upvotes / downvotes;
  return Math.pow(upvotes + downvotes, power);
};

beforeAll(async () => {
  await devQueries.truncateTable('User');
  await devQueries.createAdmin();
  await commQueries.create({
    urlName: 'comm',
    canonicalName: 'Community',
    description: 'This is an ordinary community.',
    adminId: 1,
  });
});

describe('search posts', () => {
  const postCount = 50;
  beforeAll(async () => {
    await populate({
      userCount: 200,
      commCount: 1,
      postCount,
      replies: { max: 50 },
      votes: { max: 250 },
    });
  });

  test('GET /community/:community/posts - shows max 20 posts by hotness descending, by default', async () => {
    const response = await helpers.req('GET', '/community/1/posts');
    helpers.check(response, 200);
    expect(response.body).toHaveProperty('posts');
    expect(response.body.posts.length).toBe(20);
    expect(
      [...response.body.posts].sort(
        (
          post_a: { _count: { upvotes: number; downvotes: number } },
          post_b: { _count: { upvotes: number; downvotes: number } },
        ) =>
          hotScore(post_b._count.upvotes, post_b._count.downvotes) -
          hotScore(post_a._count.upvotes, post_a._count.downvotes),
      ),
    ).toEqual(response.body.posts);
    // console.dir(response.body, { depth: null });
  });

  test('GET /community/:communityId/posts - query "take" works', async () => {
    const response = await helpers.req('GET', '/community/1/posts?take=30');
    helpers.check(response, 200);
    expect(response.body.posts.length).toBe(30);
  });

  test('GET /community/:communityId/posts - query "name" works', async () => {
    const response = await helpers.req('GET', '/community/1/posts?title=um');
    helpers.check(response, 200);
    expect(
      response.body.posts.filter((post: { title: string }) =>
        post.title.includes('um'),
      ),
    ).toEqual(response.body.posts);
  });

  test('GET /community/:communityId/posts - query "sort" works', async () => {
    // newest
    let response = await helpers.req('GET', '/community/1/posts?sort=newest');
    expect(
      [...response.body.posts].sort(
        (
          post_a: { _count: { posts: number } },
          post_b: { _count: { posts: number } },
        ) => post_b._count.posts - post_a._count.posts,
      ),
    ).toEqual(response.body.posts);
    // replies
    response = await helpers.req('GET', '/community/1/posts?sort=replies');
    expect(
      [...response.body.posts].sort(
        (
          post_a: { _count: { replies: number } },
          post_b: { _count: { replies: number } },
        ) => post_b._count.replies - post_a._count.replies,
      ),
    ).toEqual(response.body.posts);
    // top
    response = await helpers.req('GET', '/community/1/posts?sort=top');
    expect(
      [...response.body.posts].sort(
        (
          post_a: { _count: { upvotes: number; downvotes: number } },
          post_b: { _count: { upvotes: number; downvotes: number } },
        ) =>
          topScore(post_b._count.upvotes, post_b._count.downvotes) -
          topScore(post_a._count.upvotes, post_a._count.downvotes),
      ),
    ).toEqual(response.body.posts);
    // best
    response = await helpers.req('GET', '/community/1/posts?sort=best');
    helpers.check(response, 200);
    expect(
      [...response.body.posts].sort(
        (
          post_a: { _count: { upvotes: number; downvotes: number } },
          post_b: { _count: { upvotes: number; downvotes: number } },
        ) =>
          bestScore(post_b._count.upvotes, post_b._count.downvotes) -
          bestScore(post_a._count.upvotes, post_a._count.downvotes),
      ),
    ).toEqual(response.body.posts);
    // controversial
    response = await helpers.req(
      'GET',
      '/community/1/posts?sort=controversial',
    );
    helpers.check(response, 200);
    expect(
      [...response.body.posts].sort(
        (
          post_a: { _count: { upvotes: number; downvotes: number } },
          post_b: { _count: { upvotes: number; downvotes: number } },
        ) =>
          controversyScore(post_b._count.upvotes, post_b._count.downvotes) -
          controversyScore(post_a._count.upvotes, post_a._count.downvotes),
      ),
    ).toEqual(response.body.posts);
  });

  test('GET /community/:communityId/posts - pagination', async () => {
    await helpers.testPaginationStability({
      url: '/community/1/posts',
      resultsName: 'posts',
      contentCount: postCount,
      resultsLength: 20,
    });
  });

  test('GET /community/:communityId/posts - pagination maintains other queries', async () => {
    await helpers.testPaginationStability({
      url: '/community/1/posts?take=10&sort=best',
      resultsName: 'posts',
      contentCount: postCount,
      resultsLength: 10,
      perPageAssertion: (response) => {
        expect(response.body.posts.length).toBe(10);
        expect(
          [...response.body.posts].sort(
            (
              post_a: { _count: { upvotes: number; downvotes: number } },
              post_b: { _count: { upvotes: number; downvotes: number } },
            ) =>
              bestScore(post_b._count.upvotes, post_b._count.downvotes) -
              bestScore(post_a._count.upvotes, post_a._count.downvotes),
          ),
        ).toEqual(response.body.posts);
      },
    });
  });
});

describe('create, see, and edit a post', () => {
  let postId: string = '';
  let frozenPostId: string = '';
  let hiddenPostId: string = '';

  const correctInputs = {
    title: 'Another Post',
    content: 'This is another post. Lorem ipsum dolor sit amet.',
  };

  const wrongInputsArray = [
    { title: '' },
    { title: Array(1000).fill('A').join('') },
    { content: '' },
    { content: Array(100000).fill('A').join('') },
  ];

  beforeAll(async () => {
    await devQueries.truncateTable('User');
    await devQueries.createAdmin();
    await userQueries.create({ username: 'basic' });
    await commQueries.create({
      urlName: 'comm',
      canonicalName: 'Community',
      description: 'This is an ordinary community.',
      adminId: 1,
    });
    frozenPostId = await postQueries.create(1, 1, {
      title: 'Frozen Post',
      content: 'You can see, but not edit, this one.',
      status: 'FROZEN',
    });
    hiddenPostId = await postQueries.create(1, 1, {
      title: 'Hidden Post',
      content: 'You should not be able to retireve this one.',
      status: 'HIDDEN',
    });
  });

  test('POST /community/:communityId/posts - 400 and errors', async () => {
    await Promise.all(
      wrongInputsArray.map(async (wrongInputs) => {
        const response = await helpers.req(
          'POST',
          '/community/comm/posts',
          { ...correctInputs, ...wrongInputs },
          await helpers.getToken('admin'),
        );
        helpers.check(response, 400);
        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors.length).toBe(1);
      }),
    );
  });

  test('POST /community/:communityId/posts - 200 and creates post', async () => {
    let comm = await commQueries.find({ id: 1 });
    const lastActivity = comm?.lastActivity;
    const response = await helpers.req(
      'POST',
      '/community/comm/posts',
      correctInputs,
      await helpers.getToken('admin'),
    );
    helpers.check(response, 200);
    expect(response.body).toHaveProperty('postId');
    const post = await postQueries.find(response.body.postId);
    expect(post).not.toBeNull();
    postId = response.body.postId;
    // make sure lastActive date was updated
    comm = await commQueries.find({ id: 1 });
    expect(comm?.lastActivity).not.toEqual(lastActivity);
  });

  test('GET /post/:postId - 404 if post does not exist', async () => {
    const response = await helpers.req('GET', `/post/owo`);
    helpers.check(response, 404, 'Post could not be found.');
  });

  test('GET /post/:postId - 404 if post is hidden', async () => {
    const response = await helpers.req('GET', `/post/${hiddenPostId}`);
    helpers.check(response, 404, 'Post could not be found.');
  });

  test('GET /post/:postId - 200 and shows post data', async () => {
    const response = await helpers.req('GET', `/post/${postId}`);
    helpers.check(response, 200);
    // console.dir(response.body, { depth: null });
  });

  test("GET /post/:postId - 200 and reflects user's vote", async () => {
    await postQueries.vote(postId, 2, 'upvote', 'true');
    const response = await helpers.req(
      'GET',
      `/post/${postId}`,
      null,
      await helpers.getToken('basic'),
    );
    helpers.check(response, 200);
    expect(response.body).toHaveProperty('voting');
    expect(response.body.voting).toEqual({
      upvoted: true,
      downvoted: false,
    });
    // console.dir(response.body, { depth: null });
  });

  test('GET /post/:postId - 200 even if post is frozen', async () => {
    const response = await helpers.req('GET', `/post/${frozenPostId}`);
    helpers.check(response, 200);
  });

  test('PUT /post/:postId - 403 if post not yours', async () => {
    const response = await helpers.req(
      'PUT',
      `/post/${postId}`,
      null,
      await helpers.getToken('basic'),
    );
    helpers.check(response, 403, 'You are not the author of this post.');
  });

  test('PUT /post/:postId - 403 if post is frozen', async () => {
    const response = await helpers.req(
      'PUT',
      `/post/${frozenPostId}`,
      null,
      await helpers.getToken('admin'),
    );
    helpers.check(response, 403, 'This post is frozen.');
  });

  test('PUT /post/:postId - 400 and errors', async () => {
    await Promise.all(
      wrongInputsArray.map(async (wrongInputs) => {
        const response = await helpers.req(
          'PUT',
          `/post/${postId}`,
          { ...correctInputs, ...wrongInputs },
          await helpers.getToken('admin'),
        );
        helpers.check(response, 400);
        expect(response.body).toHaveProperty('errors');
        expect(response.body.errors.length).toBe(1);
      }),
    );
  });

  test('PUT /post/:postId - 200 and edits post', async () => {
    const response = await helpers.req(
      'PUT',
      `/post/${postId}`,
      { ...correctInputs, title: 'Another Post, but Different Title' },
      await helpers.getToken('admin'),
    );
    helpers.check(response, 200);
    // make sure edit date was updated
    const post = await postQueries.find(postId);
    expect(post?.title).toEqual('Another Post, but Different Title');
    expect(post?.lastEdited).not.toBeNull();
  });
});

describe('vote on posts', () => {
  let postId: string = '';
  let frozenPostId: string = '';

  beforeAll(async () => {
    await devQueries.truncateTable('User');
    await devQueries.createAdmin();
    await userQueries.create({ username: 'basic' });
    await commQueries.create({
      urlName: 'comm',
      canonicalName: 'Community',
      description: 'This is an ordinary community.',
      adminId: 1,
    });
    postId = await postQueries.create(1, 1, {
      title: 'Post',
      content: 'Vote on me.',
    });
    frozenPostId = await postQueries.create(1, 1, {
      title: 'Frozen Post',
      content: 'You can see, but not edit, this one.',
      status: 'FROZEN',
    });
  });

  describe('upvoting', () => {
    test('POST /post/:post/upvote - 403 if own post', async () => {
      const response = await helpers.req(
        'POST',
        `/post/${postId}/upvote`,
        { upvote: true },
        await helpers.getToken('admin'),
      );
      helpers.check(response, 403, 'You cannot vote on your own content.');
    });

    test('POST /post/:post/upvote - 403 if frozen', async () => {
      const response = await helpers.req(
        'POST',
        `/post/${frozenPostId}/upvote`,
        { upvote: true },
        await helpers.getToken('basic'),
      );
      helpers.check(response, 403, 'This post is frozen.');
    });

    test('POST /post/:post/upvote - 403 if removing upvote, but never upvoted', async () => {
      const response = await helpers.req(
        'POST',
        `/post/${postId}/upvote`,
        { upvote: false },
        await helpers.getToken('basic'),
      );
      helpers.check(
        response,
        403,
        'You cannot double-vote or remove a nonexistent vote.',
      );
    });

    test('POST /post/:post/upvote - 200 and adds upvote', async () => {
      const response = await helpers.req(
        'POST',
        `/post/${postId}/upvote`,
        { upvote: true },
        await helpers.getToken('basic'),
      );
      helpers.check(response, 200);
    });

    test('POST /post/:post/upvote - 403 if already upvoted', async () => {
      const response = await helpers.req(
        'POST',
        `/post/${postId}/upvote`,
        { upvote: true },
        await helpers.getToken('basic'),
      );
      helpers.check(
        response,
        403,
        'You cannot double-vote or remove a nonexistent vote.',
      );
    });

    test('POST /post/:post/upvote - 200 and removes upvote', async () => {
      const response = await helpers.req(
        'POST',
        `/post/${postId}/upvote`,
        { upvote: false },
        await helpers.getToken('basic'),
      );
      helpers.check(response, 200);
    });
  });

  describe('downvoting', () => {
    test('POST /post/:post/downvote - 403 if own post', async () => {
      const response = await helpers.req(
        'POST',
        `/post/${postId}/downvote`,
        { downvote: true },
        await helpers.getToken('admin'),
      );
      helpers.check(response, 403, 'You cannot vote on your own content.');
    });

    test('POST /post/:post/downvote - 403 if frozen', async () => {
      const response = await helpers.req(
        'POST',
        `/post/${frozenPostId}/downvote`,
        { downvote: true },
        await helpers.getToken('basic'),
      );
      helpers.check(response, 403, 'This post is frozen.');
    });

    test('POST /post/:post/downvote - 403 if removing downvote, but never downvoted', async () => {
      const response = await helpers.req(
        'POST',
        `/post/${postId}/downvote`,
        { downvote: false },
        await helpers.getToken('basic'),
      );
      helpers.check(
        response,
        403,
        'You cannot double-vote or remove a nonexistent vote.',
      );
    });

    test('POST /post/:post/downvote - 200 and adds downvote', async () => {
      const response = await helpers.req(
        'POST',
        `/post/${postId}/downvote`,
        { downvote: true },
        await helpers.getToken('basic'),
      );
      helpers.check(response, 200);
    });

    test('POST /post/:post/downvote - 403 if already downvoted', async () => {
      const response = await helpers.req(
        'POST',
        `/post/${postId}/downvote`,
        { downvote: true },
        await helpers.getToken('basic'),
      );
      helpers.check(
        response,
        403,
        'You cannot double-vote or remove a nonexistent vote.',
      );
    });

    test('POST /post/:post/downvote - 200 and removes downvote', async () => {
      const response = await helpers.req(
        'POST',
        `/post/${postId}/downvote`,
        { downvote: false },
        await helpers.getToken('basic'),
      );
      helpers.check(response, 200);
    });
  });
});

describe('hide and unhide, freeze and unfreeze a post', () => {
  let postId: string = '';
  let users: number[] = [];

  beforeAll(async () => {
    await devQueries.truncateTable('User');
    await devQueries.createAdmin();
    await commQueries.create({
      urlName: 'comm',
      canonicalName: 'Community',
      description: 'This is an ordinary community.',
      adminId: 1,
    });
    users = await devQueries.createBulkUsers([
      { username: 'demo-1' },
      { username: 'demo-2' },
      { username: 'demo-3' },
    ]);
    await devQueries.distributeCommModerators(1, [users[0]]);
    // users[0] is mod
    // users[1] is post author
    // users[2] is neither mod nor post author
    postId = await postQueries.create(1, users[1], {
      title: 'Title of Post',
      content: 'This is a post. Lorem ipsum dolor sit amet.',
    });
  });

  test('POST /post/:post/freeze - 403 if neither author nor mod', async () => {
    const response = await helpers.req(
      'POST',
      `/post/${postId}/freeze`,
      { freeze: true },
      await helpers.getToken(users[2]),
    );
    helpers.check(
      response,
      403,
      'Only the post author or a community moderator can perform this action.',
    );
  });

  test('POST /post/:post/freeze - 200 and freezes post (author)', async () => {
    const response = await helpers.req(
      'POST',
      `/post/${postId}/freeze`,
      { freeze: true },
      await helpers.getToken(users[1]),
    );
    helpers.check(response, 200);
    const post = await postQueries.find(postId);
    expect(post?.status).toBe('FROZEN');
  });

  test('POST /post/:post/freeze - 200 and freezes post (mod)', async () => {
    const response = await helpers.req(
      'POST',
      `/post/${postId}/freeze`,
      { freeze: true },
      await helpers.getToken(users[0]),
    );
    helpers.check(response, 200);
    const post = await postQueries.find(postId);
    expect(post?.status).toBe('FROZEN');
  });

  test('POST /post/:post/freeze - 200 and unfreezes post', async () => {
    const response = await helpers.req(
      'POST',
      `/post/${postId}/freeze`,
      { freeze: false },
      await helpers.getToken(users[1]),
    );
    helpers.check(response, 200);
    const post = await postQueries.find(postId);
    expect(post?.status).toBe('ACTIVE');
  });

  test('POST /post/:post/hide - 403 if neither author nor mod', async () => {
    const response = await helpers.req(
      'POST',
      `/post/${postId}/hide`,
      { freeze: true },
      await helpers.getToken(users[2]),
    );
    helpers.check(
      response,
      403,
      'Only the post author or a community moderator can perform this action.',
    );
  });

  test('POST /post/:post/hide - 200 and hides post (yourself)', async () => {
    const response = await helpers.req(
      'POST',
      `/post/${postId}/hide`,
      { hide: true },
      await helpers.getToken(users[1]),
    );
    helpers.check(response, 200);
    const post = await postQueries.find(postId);
    expect(post?.status).toBe('HIDDEN');
  });

  test('POST /post/:post/hide - 200 and hides post (mod)', async () => {
    const response = await helpers.req(
      'POST',
      `/post/${postId}/hide`,
      { hide: true },
      await helpers.getToken(users[0]),
    );
    helpers.check(response, 200);
    const post = await postQueries.find(postId);
    expect(post?.status).toBe('HIDDEN');
  });

  test('POST /post/:post/hide - 200 and unhides post', async () => {
    const response = await helpers.req(
      'POST',
      `/post/${postId}/hide`,
      { hide: false },
      await helpers.getToken(users[1]),
    );
    helpers.check(response, 200);
    const post = await postQueries.find(postId);
    expect(post?.status).toBe('ACTIVE');
  });
});
