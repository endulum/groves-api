import asyncHandler from 'express-async-handler';

import { client } from '../../prisma/client';
import * as replyQueries from '../../prisma/queries/reply';
import * as postQueries from '../../prisma/queries/post';
import * as commQueries from '../../prisma/queries/community';
import * as post from './post';

export const getForPost = [
  post.exists,
  asyncHandler(async (req, res) => {
    const { parentId, cursor, levels, takePerLevel, takeAtRoot } =
      req.query as Record<string, string | undefined>;

    const replies = await replyQueries.getTree({
      postId: req.thisPost.id,
      parentId: parentId ? (parentId === 'null' ? null : parentId) : null,
      cursor: cursor ?? undefined,
      levels: levels ? (parseInt(levels, 10) ?? 3) : 3,
      takePerLevel: takePerLevel ? (parseInt(takePerLevel, 10) ?? 10) : 3,
      takeAtRoot: takeAtRoot ? (parseInt(takeAtRoot, 10) ?? 5) : null,
    });

    res.json({ children: replies });
  }),
];

const exists = asyncHandler(async (req, res, next) => {
  const reply = await client.reply.findUnique({
    where: { id: req.params.reply.split('?')[0] },
  });
  if (reply) {
    req.thisPost = await postQueries.find(reply.postId);
    req.thisCommunity = await commQueries.find({
      id: req.thisPost.community.id,
    });
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

    const replies = await replyQueries.getTree({
      postId: req.thisPost.id,
      parentId: req.thisReply.id,
      cursor: cursor ?? undefined,
      levels: levels ? (parseInt(levels, 10) ?? 3) : 3,
      takePerLevel: takePerLevel ? (parseInt(takePerLevel, 10) ?? 10) : 3,
      takeAtRoot: takeAtRoot ? (parseInt(takeAtRoot, 10) ?? 5) : null,
    });

    res.json({ children: replies });
  }),
];
