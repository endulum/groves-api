import { faker } from '@faker-js/faker';

export function generateUsers(count: number) {
  const usernames: string[] = [];
  while (usernames.length < count) {
    const username = (faker.color.human().split(' ').join('-'))
      .concat('-')
      .concat(faker.animal.type().split(' ').join('-'));
    if (!usernames.includes(username)) 
      usernames.push(username);
  };
  
  const users: Array<{ 
    username: string, bio: string 
  }> = usernames.map(username => ({
      username, 
      bio: faker.person.bio()
    }));

  return users;

  /* [
    { username: 'black-turtle', bio: 'blogger, geek, person' },
    { username: 'indigo-sea-lion', bio: 'model, film lover' },
    { username: 'salmon-hippopotamus', bio: 'patriot, nerd, singer' },
    // ...
  ] */
};

export function generateCommunities(count: number) {
  const communityNames: string[] = [];
  while (communityNames.length < count) {
    const communityName = faker.food.dish();
    if (!communityNames.includes(communityName))
      communityNames.push(communityName);
  };

  const communities: Array<{
    urlName: string,
    canonicalName: string,
    description: string
  }> = communityNames.map(communityName => ({
    urlName: (
      communityName.toLocaleLowerCase().split(' ').join('').match(/[a-z0-9]+/g) || []
    ).join(''),
    canonicalName: communityName,
    description: 'For fans of ' + communityName
  }));

  return communities;

  /* [
    {
      urlName: 'scotcheggs',
      canonicalName: 'Scotch Eggs',
      description: 'For fans of Scotch Eggs'
    },
    {
      urlName: 'custardapplepie',
      canonicalName: 'Custard Apple Pie',
      description: 'For fans of Custard Apple Pie'
    },
    {
      urlName: 'sushi',
      canonicalName: 'Sushi',
      description: 'For fans of Sushi'
    }
    // ...
  ] */
}

export function generatePosts(count: number) {
  const posts: Array<{ title: string, content: string }> = [];

  while (posts.length < count) {
    const title = faker.lorem.words(Math.ceil(Math.random() * 8));
    const content = faker.lorem.paragraphs(Math.ceil(Math.random() * 5));
    if (title.length <= 64) posts.push({ title, content });
  }

  return posts;

  /* [
    {
      title: 'illo',
      content: 'Super vetus voluntarius. Sol vulpes summopere beatus tamen suscipit. Aeger constans tactus.\n' +
        'Tergum xiphias accusamus despecto suffragium. Sed accusantium volo volubilis est. Tenetur depono verumtamen spes.\n' +
        'Testimonium ars ventosus beatae curvo caveo audax desipio utpote. Defungo odio vitiosus ventus nulla vulnero casus cauda adulatio accusator. Corrigo alo defessus votum ratione incidunt corrumpo tyrannus tenetur.'
    },
    {
      title: 'sollers amoveo versus cultura arbitro ciminatio cogito',
      content: 'Sordeo concido sub conitor terror solvo. Verumtamen vereor dicta admoveo vester quis corrupti avaritia arx asperiores. Denuncio depulso tepidus.'
    },
    {
      title: 'facilis casus',
      content: 'Decet accusamus veniam arbustum volup crux. Verecundia tum abstergo vix arbor comitatus summa similique aequitas dedecor. Vulgivagus crepusculum concido aestus cura vulariter pax.\n' +
        'Decumbo vero quas titulus tyrannus decor certe sto adfero. Amplus uter debeo thema aduro. Desparatus decretum ver tumultus absum paens architecto minus viridis.\n' +
        'Attonbitus speciosus curiositas pax sumo adhuc patruus cauda. Audax subiungo desparatus tergum depereo stabilis trucido ullam. Ater sum cimentarius carpo veritas.'
    },
    // ...
  ] */
}