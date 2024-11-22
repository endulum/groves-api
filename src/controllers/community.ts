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

const validation = [
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
      if (parseInt(value, 10) > 0)
        throw new Error('Community URLs cannot be made solely of numbers.');
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

export const create = [
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

export const exists = asyncHandler(async (req, res, next) => {
  const community = await queries.findCommunity({
    urlName: req.params.community,
    id: parseInt(req.params.community),
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

export const get = [
  exists,
  asyncHandler(async (req, res) => {
    // no. just expand these in query in the `exists` handler..
    // const moderators = await queries.findCommMods(req.thisCommunity.id);
    // const { id, username } = req.thisCommunity.admin;
    delete req.thisCommunity.adminId;
    delete req.thisCommunity.wiki;
    res.json(req.thisCommunity);
    // also consider adding counts?
    // total votes, total posts, total followers
  }),
];

export const isNotFrozen = asyncHandler(async (req, res, next) => {
  if (req.thisCommunity.status !== 'FROZEN') next();
  else res.sendStatus(403);
});

export const isAdmin = asyncHandler(async (req, res, next) => {
  if (req.thisCommunity.admin.id === req.user.id) next();
  else res.sendStatus(403);
});

export const edit = [
  exists,
  isNotFrozen,
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

export const isAdminOrMod = asyncHandler(async (req, res, next) => {
  if (
    req.thisCommunity.admin.id === req.user.id ||
    req.thisCommunity.moderators.find(
      (mod: { id: number }) => mod.id === req.user.id,
    )
  )
    next();
  else res.sendStatus(403);
});

export const getWiki = [
  exists,
  asyncHandler(async (req, res) => {
    res.json({
      content: req.thisCommunity.wiki,
    });
  }),
];

export const editWiki = [
  exists,
  isNotFrozen,
  isAdminOrMod,
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

export const follow = [
  exists,
  isNotFrozen,
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

export const promote = [
  exists,
  isNotFrozen,
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
  isNotFrozen,
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

export const freeze = [
  exists,
  isAdmin,
  body('freeze').trim().isBoolean().escape(),
  validate,
  asyncHandler(async (req, res) => {
    await queries.freezeCommunity(
      req.thisCommunity.id,
      req.thisCommunity.status,
      req.body.freeze,
    );
    res.sendStatus(200);
  }),
];
