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

    const { results, nextCursor, prevCursor } = await postQueries.search({
      before: before ?? undefined,
      after: after ?? undefined,
      take: take ? (parseInt(take, 10) ?? 20) : 20,
      title: title ?? '',
      sort: sort ?? 'activity',
    });

    const rebuiltQuery: string[] = [];
    if (take) rebuiltQuery.push(`take=${take}`);
    if (title) rebuiltQuery.push(`name=${title}`);
    if (sort) rebuiltQuery.push(`sort=${sort}`);
    const queryString =
      rebuiltQuery.length > 0 ? '&' + rebuiltQuery.join('&') : '';

    const nextPage = nextCursor
      ? `/community/${
          req.thisCommunity.urlName
        }/posts?after=${nextCursor}${queryString}`
      : null;
    const prevPage = prevCursor
      ? `/community/${
          req.thisCommunity.urlName
        }/posts?before=${prevCursor}${queryString}`
      : null;

    res.json({
      posts: results,
      links: { nextPage, prevPage },
    });
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
  community.isNotFrozen,
  ...validation,
  validate,
  asyncHandler(async (req, res) => {
    const postId = await postQueries.create(
      req.thisCommunity.id,
      req.user.id,
      req.body,
    );
    res.json({ postId });
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

export const isNotHiddenOrMod = asyncHandler(async (req, res, next) => {
  if (req.thisPost.status !== 'HIDDEN') next();
  else if (
    req.user &&
    req.thisCommunity.moderators.find(
      (mod: { id: number }) => mod.id === req.user.id,
    )
  )
    next();
  else res.status(404).send('Post could not be found.');
});

export const get = [
  exists,
  isNotHiddenOrMod,
  asyncHandler(async (req, res) => {
    let voting: { upvoted: boolean; downvoted: boolean } | null = null;
    if (req.user) {
      voting = {
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
      voting,
    });
  }),
];

export const isAuthor = asyncHandler(async (req, res, next) => {
  if (req.thisPost.author.id === req.user.id) next();
  else res.status(403).send('You are not the author of this post.');
});

export const isNotHidden = asyncHandler(async (req, res, next) => {
  if (req.thisPost.status !== 'HIDDEN') next();
  else res.status(404).send('Post could not be found.');
});

export const isNotFrozen = asyncHandler(async (req, res, next) => {
  if (req.thisPost.status !== 'FROZEN') next();
  else res.status(403).send('This post is frozen.');
});

export const rootCommunityIsActive = asyncHandler(async (req, res, next) => {
  if (req.thisCommunity.status === 'ACTIVE') next();
  else res.status(403).send('The root community of this post is frozen.');
});

export const edit = [
  exists,
  isAuthor,
  isNotHidden,
  isNotFrozen,
  rootCommunityIsActive,
  ...validation,
  validate,
  asyncHandler(async (req, res) => {
    await postQueries.edit(req.thisPost.id, req.body);
    res.sendStatus(200);
  }),
];

export const isNotOwnPost = asyncHandler(async (req, res, next) => {
  if (req.thisPost.author.id !== req.user.id) next();
  else res.status(403).send('You cannot vote on your own content.');
});

export const upvote = [
  exists,
  isNotOwnPost,
  isNotHidden,
  isNotFrozen,
  rootCommunityIsActive,
  body('upvote').trim().isBoolean().escape(),
  validate,
  asyncHandler(async (req, res) => {
    const voted = await postQueries.didUserVote(req.thisPost.id, req.user.id);
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
      await postQueries.vote(
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
  isNotOwnPost,
  isNotHidden,
  isNotFrozen,
  rootCommunityIsActive,
  body('downvote').trim().isBoolean().escape(),
  validate,
  asyncHandler(async (req, res) => {
    const voted = await postQueries.didUserVote(req.thisPost.id, req.user.id);
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
      await postQueries.vote(
        req.thisPost.id,
        req.user.id,
        'downvote',
        req.body.downvote,
      );
      res.sendStatus(200);
    }
  }),
];

export const isAuthorOrMod = asyncHandler(async (req, res, next) => {
  if (
    req.thisPost.author.id === req.user.id ||
    req.thisCommunity.moderators.find(
      (mod: { id: number }) => mod.id === req.user.id,
    )
  )
    next();
  else
    res
      .status(403)
      .send(
        'Only the post author or a community moderator can perform this action.',
      );
});

export const freeze = [
  exists,
  isAuthorOrMod,
  isNotHidden,
  rootCommunityIsActive,
  body('freeze').trim().isBoolean().escape(),
  validate,
  asyncHandler(async (req, res) => {
    await postQueries.freeze(
      req.thisPost.id,
      req.thisPost.status,
      req.body.freeze,
    );
    res.sendStatus(200);
  }),
];

export const hide = [
  exists,
  isAuthorOrMod,
  rootCommunityIsActive,
  body('hide').trim().isBoolean().escape(),
  validate,
  asyncHandler(async (req, res) => {
    await postQueries.hide(req.thisPost.id, req.thisPost.status, req.body.hide);
    res.sendStatus(200);
  }),
];
