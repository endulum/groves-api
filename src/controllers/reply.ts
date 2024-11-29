import asyncHandler from 'express-async-handler';
import { body } from 'express-validator';
import { stringify } from 'querystring';

import { client } from '../../prisma/client';
import { validate } from '../middleware/validate';
import * as replyQueries from '../../prisma/queries/reply';
import * as postQueries from '../../prisma/queries/post';
import * as commQueries from '../../prisma/queries/community';
import * as post from './post';
import * as community from './community';
import { formatReplies } from '../../prisma/queries/helpers/formatReplies';

export const getForPost = [
  post.exists,
  post.isNotHidden,
  asyncHandler(async (req, res) => {
    const { parentId, cursor, levels, takePerLevel, takeAtRoot, sort } =
      req.query as Record<string, string | undefined>;

    // re-inits query params and optionally sets defaults for them
    const query = {
      postId: req.thisPost.id,
      ...(parentId && parentId !== 'null' && { parentId }),
      ...(cursor && { cursor }),
      levels: levels ? (parseInt(levels, 10) ?? 3) : 3,
      takePerLevel: takePerLevel ? (parseInt(takePerLevel, 10) ?? 10) : 3,
      takeAtRoot: takeAtRoot ? (parseInt(takeAtRoot, 10) ?? null) : null,
      ...(sort && { sort }),
    };

    const queryString = stringify({
      ...(query.levels !== 3 && { levels: query.levels }),
      ...(query.takePerLevel !== 3 && { takePerLevel: query.takePerLevel }),
      ...(query.takeAtRoot && { takeAtRoot: query.takeAtRoot }),
      ...(query.sort && { sort: query.sort }),
    });

    const queryResult = await replyQueries.get({ ...query, queryString });
    const formattedReplies = formatReplies({
      replies: queryResult.children,
      query,
      queryString,
      userId: req.user ? req.user.id : null,
    });

    res.json({
      children: formattedReplies,
      ...(queryResult.loadMoreChildren && {
        loadMoreChildren: queryResult.loadMoreChildren,
      }),
    });
  }),
];

const exists = asyncHandler(async (req, res, next) => {
  const reply = await client.reply.findUnique({
    where: { id: req.params.reply },
    include: { author: { select: { id: true, username: true } } },
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

export const getForReply = [
  exists,
  post.isNotHidden,
  asyncHandler(async (req, res) => {
    const { cursor, levels, takePerLevel, takeAtRoot, sort } =
      req.query as Record<string, string | undefined>;

    // re-inits query params and optionally sets defaults for them
    const query = {
      postId: req.thisPost.id,
      parentId: req.thisReply.id,
      ...(cursor && { cursor }),
      levels: levels ? (parseInt(levels, 10) ?? 3) : 3,
      takePerLevel: takePerLevel ? (parseInt(takePerLevel, 10) ?? 10) : 3,
      takeAtRoot: takeAtRoot ? (parseInt(takeAtRoot, 10) ?? null) : null,
      ...(sort && { sort }),
    };

    const queryString = stringify({
      ...(query.levels !== 3 && { levels: query.levels }),
      ...(query.takePerLevel !== 3 && { takePerLevel: query.takePerLevel }),
      ...(query.takeAtRoot && { takeAtRoot: query.takeAtRoot }),
      ...(query.sort && { sort: query.sort }),
    });

    const queryResult = await replyQueries.get({ ...query, queryString });
    const formattedReplies = formatReplies({
      replies: queryResult.children,
      query,
      queryString,
      userId: req.user ? req.user.id : null,
    });

    res.json({
      children: formattedReplies,
      ...(queryResult.loadMoreChildren && {
        loadMoreChildren: queryResult.loadMoreChildren,
      }),
    });
  }),
];

export const create = [
  post.exists,
  post.isNotHidden,
  post.isNotFrozen,
  community.isNotFrozen,
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Reply cannot have empty content.')
    .bail()
    .isLength({ max: 10000 })
    .withMessage('Reply content cannot exceed 10000 characters in length.')
    .escape(),
  body('parent')
    .trim()
    .custom(async (value) => {
      if (value !== '') {
        const existingReply = await replyQueries.find(value);
        if (!existingReply) throw new Error('No Reply exists with this ID.');
        if (existingReply.status !== 'ACTIVE')
          throw new Error('This Reply is frozen. You cannot reply to it.');
      }
    }),
  validate,
  asyncHandler(async (req, res) => {
    await replyQueries.create(
      req.user.id,
      req.thisPost.id,
      req.body.parent !== '' ? req.body.parent : null,
      req.body.content,
    );
    res.sendStatus(200);
  }),
];

export const isNotOwnReply = asyncHandler(async (req, res, next) => {
  if (req.thisReply.author.id !== req.user.id) next();
  else res.status(403).send('You cannot vote on your own content.');
});

export const upvote = [
  exists,
  post.isNotHidden,
  post.isNotFrozen,
  community.isNotFrozen,
  isNotOwnReply,
  body('upvote').trim().isBoolean().escape(),
  validate,
  asyncHandler(async (req, res) => {
    const voted = await replyQueries.didUserVote(req.thisReply.id, req.user.id);
    if (
      // you voted and you want to vote again
      (voted && req.body.upvote === 'true') ||
      // you never voted and you want to remove your vote
      (!voted && req.body.upvote === 'false')
    ) {
      res
        .status(403)
        .send('You cannot double-vote or remove a nonexistent vote.');
    } else {
      await replyQueries.vote(
        req.thisReply.id,
        req.user.id,
        'upvote',
        req.body.upvote,
      );
      res.sendStatus(200);
    }
  }),
];

export const downvote = [
  exists,
  post.isNotHidden,
  post.isNotFrozen,
  community.isNotFrozen,
  isNotOwnReply,
  body('downvote').trim().isBoolean().escape(),
  validate,
  asyncHandler(async (req, res) => {
    const voted = await replyQueries.didUserVote(req.thisReply.id, req.user.id);
    if (
      // you voted and you want to vote again
      (voted && req.body.downvote === 'true') ||
      // you never voted and you want to remove your vote
      (!voted && req.body.downvote === 'false')
    ) {
      res
        .status(403)
        .send('You cannot double-vote or remove a nonexistent vote.');
    } else {
      await replyQueries.vote(
        req.thisReply.id,
        req.user.id,
        'downvote',
        req.body.downvote,
      );
      res.sendStatus(200);
    }
  }),
];
