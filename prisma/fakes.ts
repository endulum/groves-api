import { faker } from '@faker-js/faker';

export type BulkUserData = {
  username: string;
  bio?: string;
};

/* [
    { username: 'black-turtle', bio: 'blogger, geek, person' },
    { username: 'indigo-sea-lion', bio: 'model, film lover' },
    // ...
  ] */

export type BulkCommunityData = {
  urlName: string;
  canonicalName: string;
  description?: string;
  status?: 'ACTIVE' | 'HIDDEN' | 'FROZEN';
  date?: Date;
};

/* [
    { urlName: 'scotcheggs', canonicalName: 'Scotch Eggs' },
    { urlName: 'custardapplepie', canonicalName: 'Custard Apple Pie' },
    // ...
  ] */

export type BulkPostData = {
  title: string;
  content: string;
};

/* [
    { title: 'illo',
      content: 'Super vetus voluntarius. Sol vulpes summopere beatus tamen suscipit. Aeger constans tactus...
    }, {
      title: 'sollers amoveo versus cultura arbitro ciminatio cogito',
      content: 'Sordeo concido sub conitor terror solvo. Verumtamen vereor dicta admoveo vester quis corrupti avaritia arx asperiores...'
    },
    // ...
  ] */

export function bulkUsers(count: number): BulkUserData[] {
  const usernames: string[] = [];
  while (usernames.length < count) {
    const username = faker.color
      .human()
      .split(' ')
      .join('-')
      .concat('-')
      .concat(faker.animal.type().split(' ').join('-'));
    if (usernames.includes(username) || username.length > 32) continue;
    usernames.push(username);
  }

  const users: Array<{
    username: string;
    bio: string;
  }> = usernames.map((username) => ({
    username,
    bio: faker.person.bio(),
  }));

  return users;
}

export function bulkCommunities(count: number): BulkCommunityData[] {
  const communities: Array<{
    urlName: string;
    canonicalName: string;
    date: Date;
  }> = [];
  while (communities.length < count) {
    const canonicalName = faker.food.dish();
    if (
      communities.find((c) => c.canonicalName === canonicalName) ||
      canonicalName.length > 64
    )
      continue;
    const urlName = (
      canonicalName
        .toLocaleLowerCase()
        .split(' ')
        .join('')
        .match(/[a-z0-9]+/g) || []
    ).join('');
    if (urlName.length > 32) continue;
    const date = faker.date.past({ years: 5 });
    communities.push({ urlName, canonicalName, date });
  }

  return communities;
}

export function bulkPosts(count: number): BulkPostData[] {
  const posts: Array<{ title: string; content: string }> = [];

  while (posts.length < count) {
    const title = faker.lorem.words(Math.ceil(Math.random() * 8));
    const content = faker.lorem.paragraphs(Math.ceil(Math.random() * 5));
    if (title.length <= 64) posts.push({ title, content });
  }

  return posts;
}
