import asyncHandler from 'express-async-handler';
import { Prisma } from '@prisma/client';

import { client } from '../../prisma/client';
import * as queries from '../../prisma/queries';
import * as post from './post';

async function getReplies(opts: {
  postId: string;
  parentId?: string | null;
  cursor?: string;
  levels?: number;
  takePerLevel?: number;
  takeAtRoot?: number | null;
}) {
  const levels = opts.levels ?? 3;
  const take = opts.takePerLevel ?? 3;
  const rootTake = opts.takeAtRoot ?? take;
  // by default, show max 3 levels deep, and 3 replies per depth.
  // this gets you a default max of 120 comments per request.

  // console.log({ opts, levels, take, rootTake });

  const replies = await client.reply.findMany({
    where: {
      postId: opts.postId,
      parentId: opts.parentId ?? null,
    },
    ...replyQueryNested({ take, levels }),
    cursor: opts.cursor ? { id: opts.cursor } : undefined,
    take: rootTake + 1,
  });

  const nextCursor = replies.length > rootTake ? replies.at(-1)?.id : undefined;
  // todo: page through!

  return replies.slice(0, rootTake);
}

export const getForPost = [
  post.exists,
  asyncHandler(async (req, res) => {
    const { parentId, cursor, levels, takePerLevel, takeAtRoot } =
      req.query as Record<string, string | undefined>;

    const replies = await getReplies({
      postId: req.thisPost.id,
      parentId: parentId ? (parentId === 'null' ? null : parentId) : null,
      cursor: cursor ?? undefined,
      levels: levels ? (parseInt(levels, 10) ?? 3) : 3,
      takePerLevel: takePerLevel ? (parseInt(takePerLevel, 10) ?? 10) : 3,
      takeAtRoot: takeAtRoot ? (parseInt(takeAtRoot, 10) ?? 5) : null,
    });

    res.json({
      id: null,
      children: formatReplyResults(replies, {
        takePerLevel: takePerLevel ? (parseInt(takePerLevel, 10) ?? 10) : 3,
        rebuiltQuery: 'owo=uwu',
      }),
    });
  }),
];

const exists = asyncHandler(async (req, res, next) => {
  // console.log(req.params.reply.split('?')[0]);
  const reply = await client.reply.findUnique({
    where: { id: req.params.reply.split('?')[0] },
  });
  if (reply) {
    req.thisPost = await queries.findPost(reply.postId);
    req.thisCommunity = await queries.findCommunity({ id: reply.communityId });
    req.thisReply = reply;
    next();
  } else res.status(404).send('Reply not found.');
});

export const get = [
  exists,
  asyncHandler(async (req, res) => {
    const { cursor, levels, takePerLevel, takeAtRoot } = req.query as Record<
      string,
      string | undefined
    >;

    const replies = await getReplies({
      postId: req.thisPost.id,
      parentId: req.thisReply.id,
      cursor: cursor ?? undefined,
      levels: levels ? (parseInt(levels, 10) ?? 3) : 3,
      takePerLevel: takePerLevel ? (parseInt(takePerLevel, 10) ?? 10) : 3,
      takeAtRoot: takeAtRoot ? (parseInt(takeAtRoot, 10) ?? 5) : null,
    });

    res.json({
      id: req.thisReply.id,
      children: formatReplyResults(replies, {
        takePerLevel: takePerLevel ? (parseInt(takePerLevel, 10) ?? 10) : 3,
        rebuiltQuery: 'owo=uwu',
      }),
    });
  }),
];

type Query = {
  take: number;
  orderBy?: Prisma.CommunityOrderByWithRelationInput[];
  select: {
    id: boolean;
    author: { select: { id: true; username: true } };
    datePosted: true;
    content: boolean;
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

function replyQueryNested(opts: {
  take: number;
  levels: number;
  orderBy?: Prisma.CommunityOrderByWithRelationInput[];
}) {
  const startingQuery: Query = {
    take: opts.take + 1,
    select: {
      id: true,
      author: { select: { id: true, username: true } },
      datePosted: true,
      content: true,
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

  if (opts.orderBy) query.orderBy = opts.orderBy;

  let pointer = query.select;
  let levelsLeft = opts.levels;
  while (levelsLeft > 0) {
    levelsLeft--;
    pointer.children = JSON.parse(JSON.stringify(startingQuery)) as Query; // deep copy
    pointer = pointer.children.select;
  }

  return query;
}

type Reply = {
  id: string;
  // ... and the rest of the usual reply content.
  author: { username: string; id: string };
  votes: { upvotes: number; downvotes: number; youVoted: boolean | null };
  content: string;
  datePosted: string;
  status: string;

  children?: Reply[];
  // a reply may or may not have children.
  totalChildCount: number;
  // but a reply definitely has a total child count.
  // if there isnt a children property, the total should be zero

  // if there is less children rendered than counted,
  // supply a link to load replies using this reply's id as the root
  // and with a given cursor
  loadMoreChildren?: string;
  // e.g. /reply/:reply?cursor=__________&{...queries}

  // if there is no children rendered but count is nonzero,
  // supply a link to load replies using this reply's id as the root
  loadChildren?: string;
  // e.g. /reply/:reply&{...queries}
};

function formatReplyResults(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  results: any[], // i do not have the brainpower now to tighten this
  opts: {
    takePerLevel: number; // for turning the extra 1 result into the next cursor
    userId?: number; // for checking against the vote list of each reply
    rebuiltQuery: string;
  },
) {
  return results.map((result) => {
    const reply: Reply = {
      id: result.id,
      author: result.author,
      votes: {
        upvotes: result._count.upvotes,
        downvotes: result._count.downvotes,
        youVoted: null,
      },
      datePosted: result.datePosted,
      status: result.status,
      content: result.status === 'HIDDEN' ? null : result.content,
      totalChildCount: 0,
    };

    // handle children
    if (opts.userId) {
      const upvoted = result.upvotes.find(
        (u: { id: number }) => u.id === opts.userId,
      );
      const downvoted = result.downvotes.find(
        (u: { id: number }) => u.id === opts.userId,
      );
      reply.votes.youVoted = upvoted !== undefined || downvoted !== undefined;
    } else {
      reply.votes.youVoted = null;
    }

    // handle children
    if (result?._count?.children)
      reply.totalChildCount = result._count.children;
    if ('children' in result && result.children.length > 0) {
      if (opts.takePerLevel < result._count.children) {
        const { id } = result.children.pop();
        reply.loadMoreChildren = `/reply/${reply.id}?cursor=${id}`;
        // todo: i added a slash and it got me an html error. suppress that, this is a json-only api
      }
      reply.children = formatReplyResults(result.children, opts);
    } else {
      if (result._count.children > 0) {
        reply.loadChildren = `/reply/${reply.id}`;
      }
    }

    return reply;
  });
}
