import asyncHandler from 'express-async-handler';
import { body } from 'express-validator';

import * as queries from '../../prisma/queries';
import { validate } from '../middleware/validate';

export const search = asyncHandler(async (req, res) => {
  const { before, after, take, name, sort } = req.query as Record<
    string,
    string | undefined
  >;

  const { results, nextCursor, prevCursor } = await queries.searchCommunities({
    before: before ? (parseInt(before, 10) ?? undefined) : undefined,
    after: after ? (parseInt(after, 10) ?? undefined) : undefined,
    take: take ? (parseInt(take, 10) ?? 15) : 15,
    name: name ?? '',
    sort: sort ?? 'activity',
  });

  const rebuiltQuery: string[] = [];
  if (take) rebuiltQuery.push(`take=${take}`);
  if (name) rebuiltQuery.push(`name=${name}`);
  if (sort) rebuiltQuery.push(`sort=${sort}`);
  const queryString =
    rebuiltQuery.length > 0 ? '&' + rebuiltQuery.join('&') : '';

  const nextPage = nextCursor
    ? `/communities?after=${nextCursor}${queryString}`
    : null;
  const prevPage = prevCursor
    ? `/communities?before=${prevCursor}${queryString}`
    : null;

  res.json({
    communities: results,
    links: { nextPage, prevPage },
  });
});

export const exists = asyncHandler(async (req, res, next) => {
  const community = await queries.findCommunity({
    urlName: req.params.communityUrlOrId,
    id: parseInt(req.params.communityUrlOrId),
  });
  if (
    community &&
    (!(community.status === 'HIDDEN') ||
      (req.user && req.user.id === community.adminId))
  ) {
    req.thisCommunity = community;
    next();
  } else res.sendStatus(404);
});

export const get = asyncHandler(async (req, res) => {
  const moderators = await queries.findCommMods(req.thisCommunity.id);
  const { id, username } = req.thisCommunity.admin;
  delete req.thisCommunity.adminId;
  delete req.thisCommunity.wiki;
  res.json({
    ...req.thisCommunity,
    admin: { id, username },
    moderators,
  });
});

export const getWiki = asyncHandler(async (req, res) => {
  res.json({
    content: req.thisCommunity.wiki,
  });
});

export const isActive = asyncHandler(async (req, res, next) => {
  if (req.thisCommunity.status === 'ACTIVE') next();
  else res.sendStatus(403);
});

export const isAdmin = asyncHandler(async (req, res, next) => {
  if (req.thisCommunity.adminId === req.user.id) next();
  else res.sendStatus(403);
});

export const isMod = asyncHandler(async (req, res, next) => {
  const moderators = await queries.findCommMods(req.thisCommunity.id);
  if (
    req.thisCommunity.admin.id === req.user.id ||
    moderators.find((mod) => mod.id === req.user.id)
  )
    next();
  else res.sendStatus(403);
});

export const validation = [
  body('urlName')
    .trim()
    .notEmpty()
    .withMessage('Please enter a URL name for this community.')
    .bail()
    .isLength({ min: 2, max: 32 })
    .withMessage(
      'Community URL names must be between 2 and 32 characters long.',
    )
    .bail()
    .matches(/^[a-z0-9]+$/g)
    .withMessage('Community URL names must only contain lowercase and numbers.')
    .bail()
    .custom(async (value, { req }) => {
      const existingCommunity = await queries.findCommunity({ urlName: value });
      if (
        existingCommunity && // a community exists
        !(
          'thisCommunity' in req &&
          existingCommunity.id === req.thisCommunity.id
        ) // the existing community is NOT this community
      ) {
        throw new Error(
          'A community with this URL name already exists. Community URLs must be unique.',
        );
      }
    })
    .escape(),
  body('canonicalName')
    .trim()
    .notEmpty()
    .withMessage('Please enter a canonical name for this community.')
    .bail()
    .isLength({ min: 2, max: 32 })
    .withMessage(
      'Community canonical names must be between 2 and 32 characters long.',
    )
    .escape(),
  body('description')
    .trim()
    .notEmpty()
    .withMessage('Please enter a description for this community.')
    .bail()
    .isLength({ min: 2, max: 200 })
    .withMessage('Community descriptions cannot exceed 200 charatcers.')
    .escape(),
];

export const newCommunity = [
  ...validation,
  validate,
  asyncHandler(async (req, res) => {
    await queries.createCommunity({
      urlName: req.body.urlName,
      canonicalName: req.body.canonicalName,
      description: req.body.description,
      adminId: req.user.id,
    });
    res.sendStatus(200);
  }),
];

export const updateCommunity = [
  exists,
  isActive,
  isAdmin,
  ...validation,
  validate,
  asyncHandler(async (req, res) => {
    await queries.editCommunity(req.thisCommunity.id, {
      urlName: req.body.urlName,
      canonicalName: req.body.canonicalName,
      description: req.body.description,
    });
    res.sendStatus(200);
  }),
];

export const promote = [
  exists,
  isActive,
  isAdmin,
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Please enter a username.')
    .bail()
    .custom(async (value, { req }) => {
      const existingUser = await queries.findUser({ username: value });
      if (!existingUser) {
        throw new Error('No user exists with this username.');
      }
      if (existingUser.id === req.user.id) {
        throw new Error('You cannot promote yourself.');
      }
      const moderators = await queries.findCommMods(req.thisCommunity.id);
      if (moderators.find(({ id }) => id === existingUser.id)) {
        throw new Error('This user is already a moderator of this community.');
      }
      req.thisUser = existingUser;
    })
    .escape(),
  validate,
  asyncHandler(async (req, res) => {
    await queries.promoteModerator(req.thisCommunity.id, req.thisUser.id);
    res.sendStatus(200);
  }),
];

export const demote = [
  exists,
  isActive,
  isAdmin,
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Please enter a username.')
    .bail()
    .custom(async (value, { req }) => {
      const existingUser = await queries.findUser({ username: value });
      if (!existingUser) {
        throw new Error('No user exists with this username.');
      }
      if (existingUser.id === req.user.id) {
        throw new Error('You cannot demote yourself.');
      }
      const moderators = await queries.findCommMods(req.thisCommunity.id);
      if (!moderators.find(({ id }) => id === existingUser.id)) {
        throw new Error('This user is not a moderator of this community.');
      }
      req.thisUser = existingUser;
    })
    .escape(),
  validate,
  asyncHandler(async (req, res) => {
    await queries.demoteModerator(req.thisCommunity.id, req.thisUser.id);
    res.sendStatus(200);
  }),
];

export const follow = [
  exists,
  isActive,
  body('follow').trim().isBoolean().escape(),
  validate,
  asyncHandler(async (req, res) => {
    await queries.followCommunity(
      req.thisCommunity.id,
      req.user.id,
      req.body.follow,
    );
    res.sendStatus(200);
  }),
];

export const freeze = [
  exists,
  isAdmin,
  body('password')
    .notEmpty()
    .withMessage('Please enter your password.')
    .bail()
    .custom(async (value, { req }) => {
      const match = await queries.comparePassword(req.user, value);
      if (!match) throw new Error('Incorrect username or password.');
    })
    .escape(),
  validate,
  asyncHandler(async (req, res) => {
    if (req.thisCommunity.status === 'ACTIVE')
      await queries.freezeCommunity(req.thisCommunity.id, 'FROZEN');
    else if (req.thisCommunity.status === 'FROZEN')
      await queries.freezeCommunity(req.thisCommunity.id, 'ACTIVE');
    res.sendStatus(200);
  }),
];

export const editWiki = [
  exists,
  isActive,
  isMod,
  body('content').trim().escape(),
  validate,
  asyncHandler(async (req, res) => {
    if (req.body.content === '')
      await queries.editCommunityWiki(req.thisCommunity.id, null);
    else
      await queries.editCommunityWiki(req.thisCommunity.id, req.body.content);
    res.sendStatus(200);
  }),
];
