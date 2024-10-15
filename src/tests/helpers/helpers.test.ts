import * as helpers from './helpers';
import prisma from '../../prisma';

async function clear() {
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
