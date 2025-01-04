import asyncHandler from 'express-async-handler';
import { body } from 'express-validator';

import { validate } from '../middleware/validate';
import * as postQueries from '../../prisma/queries/post';
import * as commQueries from '../../prisma/queries/community';
import * as community from './community';

export const search = [
  community.exists,
  asyncHandler(async (req, res) => {
    const { before, after, take, title, sort } = req.query as Record<
      string,
      string | undefined
    >;

    const { posts, links } = await postQueries.search(
      req.thisCommunity.urlName,
      {
        before: before ?? undefined,
        after: after ?? undefined,
        take: take ? (parseInt(take, 10) ?? 20) : 20,
      },
      {
        title: title ?? '',
        sort: sort ?? 'activity',
      },
    );

    res.json({ posts, links });
  }),
];

const validation = [
  body('title')
    .trim()
    .notEmpty()
    .withMessage('Please enter a title for this post.')
    .bail()
    .isLength({ max: 64 })
    .withMessage('Post title cannot exceed 64 characters in length.')
    .escape(),
  body('content')
    .trim()
    .notEmpty()
    .withMessage('Post cannot have empty content.')
    .bail()
    .isLength({ max: 10000 })
    .withMessage('Post content cannot exceed 10000 characters in length.')
    .escape(),
];

export const create = [
  community.exists,
  community.isNotReadonly,
  ...validation,
  validate,
  asyncHandler(async (req, res) => {
    const id = await postQueries.create(
      req.thisCommunity.id,
      req.user.id,
      req.body,
    );
    res.json({ id });
  }),
];

export const exists = asyncHandler(async (req, res, next) => {
  const post = await postQueries.find(req.params.post);
  if (post) {
    req.thisPost = post;
    req.thisCommunity = await commQueries.find({
      id: req.thisPost.community.id,
    });
    next();
  } else res.status(404).send('Post could not be found.');
});

export const get = [
  exists,
  asyncHandler(async (req, res) => {
    let isVoted: { upvoted: boolean; downvoted: boolean } = {
      upvoted: false,
      downvoted: false,
    };

    if (req.user) {
      isVoted = {
        upvoted: req.thisPost.upvotes.some(
          (voter: { id: number }) => voter.id === req.user.id,
        ),
        downvoted: req.thisPost.downvotes.some(
          (voter: { id: number }) => voter.id === req.user.id,
        ),
      };
    }

    delete req.thisPost.upvotes;
    delete req.thisPost.downvotes;
    res.json({
      ...req.thisPost,
      context: {
        // did the auth'd user vote?
        isVoted,
        // does the auth'd user have mod privileges?
        isMod:
          req.user !== undefined &&
          (req.thisCommunity.admin.id === req.user.id ||
            req.thisCommunity.moderators.find(
              (mod: { id: number }) => mod.id === req.user.id,
            ) !== undefined),
        // is the author a mod of this comm?
        isPostAuthorMod:
          req.thisCommunity.moderators.find(
            (mod: { id: number }) => mod.id === req.thisPost.author.id,
          ) !== undefined,
        isPostAuthorAdmin:
          req.thisCommunity.admin.id === req.thisPost.author.id,
        isCommReadonly: req.thisCommunity.readonly,
      },
    });
  }),
];

export const isAuthor = asyncHandler(async (req, res, next) => {
  if (req.thisPost.author.id === req.user.id) next();
  else res.status(403).send('You are not the author of this post.');
});

export const isNotReadonly = asyncHandler(async (req, res, next) => {
  if (req.thisPost.readonly === false) next();
  else res.status(403).send('This post is read-only.');
});

export const edit = [
  exists,
  isNotReadonly,
  community.isNotReadonly,
  isAuthor,
  ...validation,
  validate,
  asyncHandler(async (req, res) => {
    await postQueries.edit(req.thisPost.id, req.body);
    res.sendStatus(200);
  }),
];

export const vote = [
  exists,
  isNotReadonly,
  community.isNotReadonly,
  asyncHandler(async (req, res, next) => {
    if (req.thisPost.author.id !== req.user.id) next();
    else res.status(403).send('You cannot vote on your own content.');
  }),
  body('type').trim().isIn(['upvote', 'downvote']).escape(),
  body('action').trim().isIn(['add', 'remove']).escape(),
  validate,
  asyncHandler(async (req, res) => {
    const voted = await postQueries.didUserVote(req.thisPost.id, req.user.id);
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
      await postQueries.vote(
        req.thisPost.id,
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
  body('readonly').trim().isBoolean().escape(),
  validate,
  asyncHandler(async (req, res) => {
    if (req.thisPost.readonly === true && req.body.readonly === 'true')
      res.status(400).send('This post is already readonly.');
    else if (req.thisPost.readonly === false && req.body.readonly === 'false')
      res.status(400).send('This post is not readonly.');
    else {
      await postQueries.toggleReadonly(
        req.thisPost.id,
        req.body.readonly,
        req.user.id,
      );
      res.sendStatus(200);
    }
  }),
];
