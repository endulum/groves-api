import asyncHandler from 'express-async-handler';
import { body } from 'express-validator';
import { stringify } from 'querystring';

import { validate } from '../middleware/validate';
import * as replyQueries from '../../prisma/queries/reply';
import * as postQueries from '../../prisma/queries/post';
import * as commQueries from '../../prisma/queries/community';
import * as post from './post';
import * as community from './community';
import { formatReplies } from '../../prisma/queries/helpers/formatReplies';

export const getForPost = [
  post.exists,
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
      postReadonly: req.thisPost.readonly,
      commReadonly: req.thisCommunity.readonly,
    });

    const viewingAsMod =
      req.user !== undefined &&
      (req.thisCommunity.admin.id === req.user.id ||
        req.thisCommunity.moderators.find(
          (mod: { id: number }) => mod.id === req.user.id,
        ));

    res.json({
      viewingAsMod,
      children: formattedReplies,
      ...(queryResult.loadMoreChildren && {
        loadMoreChildren: queryResult.loadMoreChildren,
      }),
    });
  }),
];

const exists = asyncHandler(async (req, res, next) => {
  const reply = await replyQueries.getOne(req.params.reply);
  if (reply) {
    req.thisPost = await postQueries.find(reply.postId);
    req.thisCommunity = await commQueries.find({
      id: req.thisPost.community.id,
    });
    req.thisReply = reply;
    next();
  } else res.status(404).send('Reply could not be found.');
});

export const isNotHidden = asyncHandler(async (req, res, next) => {
  if (req.thisReply.hidden === false) next();
  else res.status(404).send('Reply could not be found.');
});

const formatReply = asyncHandler(async (req, _res, next) => {
  // voted status
  const voted = req.user
    ? {
        upvoted:
          req.thisReply.upvotes.find(
            (u: { id: number }) => u.id === req.user.id,
          ) !== undefined,
        downvoted:
          req.thisReply.downvotes.find(
            (u: { id: number }) => u.id === req.user.id,
          ) !== undefined,
      }
    : null;
  delete req.thisReply.upvotes;
  delete req.thisReply.downvotes;
  req.thisReply.voted = voted;

  // can vote
  req.thisReply.canVote = !(
    req.thisPost.readonly ||
    req.thisCommunity.readonly ||
    req.thisReply.hidden
  );

  // are you a mod
  req.thisReply.viewingAsMod =
    req.user !== undefined &&
    (req.thisCommunity.admin.id === req.user.id ||
      req.thisCommunity.moderators.find(
        (mod: { id: number }) => mod.id === req.user.id,
      ));

  // is it hidden
  if (req.thisReply.hidden === true) {
    req.thisReply.author = null;
    req.thisReply.content = null;
    req.thisReply.voted = null;
    req.thisReply._count.upvotes = null;
    req.thisReply._count.downvotes = null;
  }

  next();
});

export const get = [
  exists,
  formatReply,
  asyncHandler(async (req, res) => {
    res.json({
      ...req.thisReply,
    });
  }),
];

export const getForReply = [
  exists,
  formatReply,
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
      postReadonly: req.thisPost.readonly,
      commReadonly: req.thisCommunity.readonly,
    });

    res.json({
      ...req.thisReply,
      children: formattedReplies,
      ...(queryResult.loadMoreChildren && {
        loadMoreChildren: queryResult.loadMoreChildren,
      }),
    });
  }),
];

const validation = body('content')
  .trim()
  .notEmpty()
  .withMessage('Reply cannot have empty content.')
  .bail()
  .isLength({ max: 10000 })
  .withMessage('Reply content cannot exceed 10000 characters in length.')
  .escape();

export const create = [
  post.exists,
  post.isNotReadonly,
  community.isNotReadonly,
  validation,
  body('parent')
    .trim()
    .custom(async (value) => {
      if (value !== '') {
        const existingReply = await replyQueries.find(value);
        if (!existingReply) throw new Error('No reply exists with this ID.');
        if (existingReply.hidden === true)
          throw new Error('This reply is hidden. You cannot reply to it.');
      }
    }),
  validate,
  asyncHandler(async (req, res) => {
    const reply = await replyQueries.create(
      req.user.id,
      req.thisPost.id,
      req.body.parent !== '' ? req.body.parent : null,
      req.body.content,
    );
    // console.log(reply);
    res.json({
      ...reply,
      voted: {
        upvoted: false,
        downvoted: false,
      },
      canVote: true,
    });
  }),
];

export const isAuthor = asyncHandler(async (req, res, next) => {
  if (req.thisReply.author.id === req.user.id) next();
  else res.status(403).send('You are not the author of this reply.');
});

export const vote = [
  exists,
  isNotHidden,
  post.isNotReadonly,
  community.isNotReadonly,
  asyncHandler(async (req, res, next) => {
    if (req.thisReply.author.id !== req.user.id) next();
    else res.status(403).send('You cannot vote on your own content.');
  }),
  body('type').trim().isIn(['upvote', 'downvote']).escape(),
  body('action').trim().isIn(['add', 'remove']).escape(),
  validate,
  asyncHandler(async (req, res) => {
    const voted = await replyQueries.didUserVote(req.thisReply.id, req.user.id);
    if (
      // you voted and you want to vote again
      (voted && req.body.action === 'add') ||
      // you never voted and you want to remove your vote
      (!voted && req.body.action === 'remove')
    ) {
      res
        .status(403)
        .send('You cannot double-vote or remove a nonexistent vote.');
    } else {
      await replyQueries.vote(
        req.thisReply.id,
        req.user.id,
        req.body.type,
        req.body.action,
      );
      res.sendStatus(200);
    }
  }),
];

export const editStatus = [
  exists,
  community.isNotReadonly,
  community.isAdminOrMod,
  post.isNotReadonly,
  body('hidden').trim().isBoolean().escape(),
  validate,
  asyncHandler(async (req, res) => {
    if (req.thisReply.hidden === true && req.body.hidden === 'true')
      res.status(400).send('This reply is already hidden.');
    else if (req.thisReply.hidden === false && req.body.hidden === 'false')
      res.status(400).send('This reply is not hidden.');
    else {
      await replyQueries.toggleHidden(req.thisReply.id, req.body.hidden);
      res.sendStatus(200);
    }
  }),
];
