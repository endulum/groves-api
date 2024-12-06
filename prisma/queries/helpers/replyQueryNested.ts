import { Prisma } from '@prisma/client';

type Query = {
  take: number;
  orderBy?: Prisma.CommunityOrderByWithRelationInput[];
  select: {
    id: boolean;
    author: { select: { id: true; username: true } };
    datePosted: true;
    content: boolean;
    hidden: true;
    _count: {
      select: {
        children: true;
        upvotes: true;
        downvotes: true;
      };
    };
    upvotes: { select: { id: true } };
    downvotes: { select: { id: true } };
    children: Query | boolean;
  };
};

export function replyQueryNested(opts: {
  take: number;
  levels: number;
  orderBy?: Prisma.CommunityOrderByWithRelationInput[];
}) {
  const startingQuery: Query = {
    orderBy: opts.orderBy ?? [],
    take: opts.take + 1,
    select: {
      id: true,
      author: { select: { id: true, username: true } },
      datePosted: true,
      content: true,
      hidden: true,
      _count: {
        select: {
          children: true,
          upvotes: true,
          downvotes: true,
        },
      },
      upvotes: { select: { id: true } },
      downvotes: { select: { id: true } },
      children: false,
    },
  };

  const query = JSON.parse(JSON.stringify(startingQuery)) as Query;

  // if (opts.orderBy) query.orderBy = opts.orderBy;

  // the magic occurs here
  let pointer = query.select;
  let levelsLeft = opts.levels;
  while (levelsLeft > 0) {
    levelsLeft--;
    pointer.children = JSON.parse(JSON.stringify(startingQuery)) as Query; // deep copy
    pointer = pointer.children.select;
  }

  return query;
}
