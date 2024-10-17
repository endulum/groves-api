import * as helpers from './helpers';
import prisma from '../prisma';

async function clear() {
  await prisma.action.deleteMany();
  await prisma.$queryRaw`ALTER SEQUENCE "Action_id_seq" RESTART WITH 1;`;
  await prisma.community.deleteMany({});
  await prisma.$queryRaw`ALTER SEQUENCE "Community_id_seq" RESTART WITH 1;`;
  await prisma.user.deleteMany({});
  await prisma.$queryRaw`ALTER SEQUENCE "User_id_seq" RESTART WITH 1;`;
}

beforeAll(async () => { await clear(); });
afterAll(async () => { await clear(); });

describe('wipeTables helper', () => {
  test('it works', async () => {
    await helpers.wipeTables(['user']);
    const users = await prisma.user.findMany({});
    expect(users).toHaveLength(0);
  });
});

describe('createUser helper', () => {
  test('it works', async () => {
    await helpers.createUsers(['basic']);
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    expect(admin).toBeDefined();
    const basic = await prisma.user.findFirst({ where: { role: 'BASIC' } });
    expect(basic).toBeDefined();
    await helpers.wipeTables(['user']);
  });
});

describe('getUser helper', () => {
  test('it works', async () => {
    await helpers.createUsers([]);
    const user = await helpers.getUser('admin', process.env.ADMIN_PASS as string);
    expect(user).toBeDefined();
    await Promise.all(['username', 'id', 'token'].map(async (property) => {
      expect(user).toHaveProperty(property);
    }));
  });
});

describe('req helper', () => {
  test('it works', async () => {
    const resWithoutAuth = await helpers.req('GET', '/', null, null);
    expect(resWithoutAuth.status).toBe(401);
    const { token } = await helpers.getUser('admin', process.env.ADMIN_PASS as string);
    const resWithAuth = await helpers.req('GET', '/', null, token);
    expect(resWithAuth.status).toBe(200);
  });
});

describe('dummy generators', () => {
  beforeAll(async () => { await clear(); });

  test('generate users - it works', async () => {
    const users = await helpers.generateDummyUsers(5);
    expect(users.length).toBe(5);
    expect(users.every((user) => user.username)).toBeTruthy();
  });

  test('generate communities - it works', async () => {
    const communities = await helpers.generateDummyCommunities(5);
    expect(communities.length).toBe(5);
    expect(communities.every((community) => community.urlName)).toBeTruthy();
  });

  test('generate posts - it works', async () => {
    const posts = await helpers.generateDummyPosts(5);
    expect(posts.length).toBe(5);
    expect(posts.every((post) => post.title)).toBeTruthy();
  });
});
