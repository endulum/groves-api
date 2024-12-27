import { req, assertCode, assertInputErrors, token, logBody } from '../helpers';
import { seed } from '../../prisma/seed';
import * as commQueries from '../../prisma/queries/community';
import * as devQueries from '../../prisma/queries/dev';

let adminToken: string = '';
let commId: number = 0;
const users: Array<{ username: string; id: number }> = [];

const correctInputs = {
  urlName: 'askgroves',
  canonicalName: 'Ask Groves',
  description:
    'This is the place to ask and answer thought-provoking questions.',
};

const wrongInputs = [
  { urlName: '' },
  { canonicalName: '' },
  { description: '' },
  { urlName: 'a' },
  { urlName: Array(1000).fill('A').join('') },
  { urlName: '&&&' },
  { urlName: 'bestofgroves' },
  { urlName: '12345' },
  { canonicalName: 'a' },
  { canonicalName: Array(1000).fill('A').join('') },
  { description: Array(1000).fill('A').join('') },
];

beforeAll(async () => {
  await seed({});
  adminToken = await token(1);
  await commQueries.create({
    urlName: 'bestofgroves',
    canonicalName: 'Best of Groves',
    description: 'The funniest and most memorable happenings.',
    adminId: 1,
  });
  // create three demo users *in order* using a for loop
  for (const username of ['demo-1', 'demo-2', 'demo-3']) {
    users.push(...(await devQueries.createBulkUsers([{ username }])));
  }
});

describe('POST /communities', () => {
  test('400 and errors', async () => {
    assertInputErrors({
      reqArgs: ['POST /communities', adminToken],
      correctInputs,
      wrongInputs,
    });
  });

  test('200 and creates a community', async () => {
    const response = await req('POST /communities', adminToken, correctInputs);
    assertCode(response, 200);
    expect(response.body.id).not.toBeUndefined();
    commId = response.body.id;
  });
});

describe('GET /community/:community', () => {
  test('404 if not found', async () => {
    const response = await req('GET /community/owo');
    assertCode(response, 404, 'Community could not be found.');
  });

  test('200 and views a community', async () => {
    const response = await req(`GET /community/${commId}`);
    assertCode(response, 200);
    // KEEP
    logBody(response);
  });
});

describe('PUT /community/:community', () => {
  test('400 and errors', async () => {
    await assertInputErrors({
      reqArgs: [`PUT /community/${commId}`, adminToken],
      correctInputs,
      wrongInputs,
    });
  });

  test('200 and edits a community', async () => {
    const response = await req(
      `PUT /community/${commId}`,
      adminToken,
      correctInputs,
    );
    assertCode(response, 200);
  });
});

describe('GET /community/:community/wiki', () => {
  test('200 and views wiki', async () => {
    const response = await req(`GET /community/${commId}/wiki`);
    assertCode(response, 200);
    expect(response.body.wiki).toBeDefined();
  });
});

describe('PUT /community/:community/wiki', () => {
  const content = 'This is some wiki content.';

  test('200 and edits wiki', async () => {
    let response = await req(`PUT /community/${commId}/wiki`, adminToken, {
      content,
    });
    assertCode(response, 200);
    response = await req(`GET /community/${commId}/wiki`);
    assertCode(response, 200);
    expect(response.body.wiki).toEqual(content);
  });

  test('200 and clears wiki', async () => {
    let response = await req(`PUT /community/${commId}/wiki`, adminToken, {
      content: '',
    });
    assertCode(response, 200);
    response = await req(`GET /community/${commId}/wiki`);
    assertCode(response, 200);
    expect(response.body.wiki).toBeNull();
  });
});

describe('PUT /community/:community/moderators', () => {
  beforeAll(async () => {
    // make demo-1 a mod
    await devQueries.distributeCommModerators(commId, [users[0].id]);
  });

  test('400 and errors', async () => {
    await assertInputErrors({
      reqArgs: [`PUT /community/${commId}/moderators`, adminToken],
      correctInputs: { username: 'demo-2', type: 'promote' },
      wrongInputs: [
        { username: '' },
        { type: '' },
        { username: 'owo' }, // user doesn't exist
        { type: 'owo' }, // not a valid type
        { username: 'admin' }, // can't promote or demote yourself
        { username: 'demo-1', type: 'promote' }, // already a mod
        { username: 'demo-2', type: 'demote' }, // already a mod
      ],
    });
  });

  test('200 and promotes a user', async () => {
    let response = await req(
      `PUT /community/${commId}/moderators`,
      adminToken,
      { username: 'demo-2', type: 'promote' },
    );
    assertCode(response, 200);
    response = await req(`GET /community/${commId}`);
    expect(
      response.body.moderators.find(
        (m: { username: string }) => m.username === 'demo-2',
      ),
    ).toBeDefined();
  });

  test('200 and demotes a user', async () => {
    let response = await req(
      `PUT /community/${commId}/moderators`,
      adminToken,
      { username: 'demo-2', type: 'demote' },
    );
    assertCode(response, 200);
    response = await req(`GET /community/${commId}`);
    expect(
      response.body.moderators.find(
        (m: { username: string }) => m.username === 'demo-2',
      ),
    ).not.toBeDefined();
  });
});

describe('PUT /community/:community/followers', async () => {
  beforeAll(async () => {
    await commQueries.follow(commId, users[0].id, 'true');
  });

  test('400 if double follow', async () => {
    const response = await req(
      `PUT /community/${commId}/followers`,
      await token('demo-1'),
      { follow: true },
    );
    assertCode(response, 400, 'You are already following this community.');
  });

  test('400 if double unfollow', async () => {
    const response = await req(
      `PUT /community/${commId}/followers`,
      await token('demo-2'),
      { follow: false },
    );
    assertCode(response, 400, 'You are not following this community.');
  });

  test('200 and follow', async () => {
    const response = await req(
      `PUT /community/${commId}/followers`,
      await token('demo-2'),
      { follow: true },
    );
    assertCode(response, 200);
    const followers = await commQueries.findFollowers(commId);
    expect(followers.find((f) => f.username === 'demo-2')).toBeDefined();
  });

  test('200 and unfollow', async () => {
    const response = await req(
      `PUT /community/${commId}/followers`,
      await token('demo-2'),
      { follow: false },
    );
    assertCode(response, 200);
    const followers = await commQueries.findFollowers(commId);
    expect(followers.find((f) => f.username === 'demo-2')).not.toBeDefined();
  });
});

describe('PUT /community/:community/status', async () => {
  test('400 if double freeze', async () => {
    const response = await req(`PUT /community/${commId}/status`, adminToken, {
      readonly: 'false',
    });
    assertCode(response, 400, 'This community is not readonly.');
  });

  test('200 and freezes', async () => {
    let response = await req(`PUT /community/${commId}/status`, adminToken, {
      readonly: 'true',
    });
    assertCode(response, 200);
    response = await req(`GET /community/${commId}`);
    expect(response.body.readonly).toBe(true);
  });

  test('400 if double unfreeze', async () => {
    const response = await req(`PUT /community/${commId}/status`, adminToken, {
      readonly: 'true',
    });
    assertCode(response, 400, 'This community is already readonly.');
  });

  test('200 and unfreezes', async () => {
    let response = await req(`PUT /community/${commId}/status`, adminToken, {
      readonly: 'false',
    });
    assertCode(response, 200);
    response = await req(`GET /community/${commId}`);
    expect(response.body.readonly).toBe(false);
  });
});
