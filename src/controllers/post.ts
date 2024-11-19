import asyncHandler from 'express-async-handler';
import { body } from 'express-validator';

import { validate } from '../middleware/validate';
import * as queries from '../../prisma/queries';
import * as community from './community';

export const exists = asyncHandler(async (req, res, next) => {
  const post = await queries.findPost(req.params.postId);
  if (post) {
    req.thisPost = post;
    next();
  } else res.sendStatus(404);
});

export const isActive = asyncHandler(async (req, res, next) => {
  if (req.thisPost.status === 'ACTIVE') next();
  else res.sendStatus(403);
});

export const rootCommunityIsActive = asyncHandler(async (req, res, next) => {
  const community = await queries.findCommunity({
    id: req.thisPost.community.id,
  });
  if (community && community.status === 'ACTIVE') next();
  else res.sendStatus(403);
});

export const isUnhidden = asyncHandler(async (req, res, next) => {
  if (req.thisPost.status !== 'HIDDEN') next();
  else res.sendStatus(404);
});

export const isUnhiddenOrMod = asyncHandler(async (req, res, next) => {
  if (req.thisPost.status !== 'HIDDEN') next();
  else if (req.user) {
    const moderators = await queries.findCommMods(req.thisPost.community.id);
    if (moderators.find((mod) => mod.id === req.user.id)) next();
    else res.sendStatus(404);
  } else res.sendStatus(404);
});

export const isAuthor = asyncHandler(async (req, res, next) => {
  if (req.thisPost.author.id === req.user.id) next();
  else res.sendStatus(403);
});

export const isAuthorOrMod = asyncHandler(async (req, res, next) => {
  const moderators = await queries.findCommMods(req.thisPost.community.id);
  if (
    req.thisPost.author.id === req.user.id ||
    moderators.find((mod) => mod.id === req.user.id)
  )
    next();
  else res.sendStatus(403);
});

export const validation = [
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

export const get = [
  exists,
  isUnhiddenOrMod,
  asyncHandler(async (req, res) => {
    res.json(req.thisPost);
  }),
];

export const newPost = [
  community.exists,
  community.isActive,
  ...validation,
  validate,
  asyncHandler(async (req, res) => {
    const postId = await queries.createPost(
      req.thisCommunity.id,
      req.user.id,
      req.body,
    );
    res.json({ postId: postId });
  }),
];

export const editPost = [
  exists,
  isAuthor,
  isUnhidden,
  isActive,
  rootCommunityIsActive,
  ...validation,
  validate,
  asyncHandler(async (req, res) => {
    await queries.editPost(req.thisPost.id, req.body);
    res.sendStatus(200);
  }),
];

export const freezePost = [
  exists,
  isAuthorOrMod,
  isUnhidden,
  rootCommunityIsActive,
  body('freeze').trim().isBoolean().escape(),
  validate,
  asyncHandler(async (req, res) => {
    await queries.freezePost(
      req.thisPost.id,
      req.thisPost.status,
      req.body.freeze,
    );
    res.sendStatus(200);
  }),
];

export const hidePost = [
  exists,
  isAuthorOrMod,
  rootCommunityIsActive,
  body('hide').trim().isBoolean().escape(),
  validate,
  asyncHandler(async (req, res) => {
    await queries.hidePost(req.thisPost.id, req.thisPost.status, req.body.hide);
    res.sendStatus(200);
  }),
];

export const upvote = [
  exists,
  isActive,
  rootCommunityIsActive,
  body('upvote').trim().isBoolean().escape(),
  validate,
  asyncHandler(async (req, res) => {
    if (req.thisPost.author.id === req.user.id) res.sendStatus(403);
    else {
      await queries.votePost(
        req.thisPost.id,
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
  isActive,
  rootCommunityIsActive,
  body('downvote').trim().isBoolean().escape(),
  validate,
  asyncHandler(async (req, res) => {
    if (req.thisPost.author.id === req.user.id) res.sendStatus(403);
    else {
      await queries.votePost(
        req.thisPost.id,
        req.user.id,
        'downvote',
        req.body.downvote,
      );
      res.sendStatus(200);
    }
  }),
];
