import asyncHandler from 'express-async-handler';
import { body } from 'express-validator';

import * as userQueries from '../../prisma/queries/user';
import * as commQueries from '../../prisma/queries/community';
import { getForCommunity } from '../../prisma/queries/action';
import { validate } from '../middleware/validate';

export const search = asyncHandler(async (req, res) => {
  const { before, after, take, name, sort } = req.query as Record<
    string,
    string | undefined
  >;

  const { communities, links } = await commQueries.search(
    {
      before: before ? (parseInt(before, 10) ?? undefined) : undefined,
      after: after ? (parseInt(after, 10) ?? undefined) : undefined,
      take: take ? (parseInt(take, 10) ?? 15) : 15,
    },
    {
      name: name ?? '',
      sort: sort ?? 'activity',
    },
  );

  res.json({
    communities,
    links,
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
      const existingCommunity = await commQueries.find({ urlName: value });
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
    const id = await commQueries.create({
      urlName: req.body.urlName,
      canonicalName: req.body.canonicalName,
      description: req.body.description,
      adminId: req.user.id,
    });
    res.json({ id });
  }),
];

export const exists = asyncHandler(async (req, res, next) => {
  const community = await commQueries.find({
    urlName: req.params.community,
    id: parseInt(req.params.community),
  });
  if (community) {
    req.thisCommunity = community;
    next();
  } else res.status(404).send('Community could not be found.');
});

export const get = [
  exists,
  asyncHandler(async (req, res) => {
    delete req.thisCommunity.adminId;
    delete req.thisCommunity.wiki;
    res.json({
      ...req.thisCommunity,
      context: {
        isFollowing:
          req.user !== undefined &&
          (await commQueries.findFollowers(req.thisCommunity.id)).find(
            (follower) => follower.id === req.user.id,
          ) !== undefined,
      },
    });
  }),
];

export const isNotReadonly = asyncHandler(async (req, res, next) => {
  if (req.thisCommunity.readonly === false) next();
  else res.status(403).send('This community is read-only.');
});

export const isAdmin = asyncHandler(async (req, res, next) => {
  if (req.thisCommunity.admin.id === req.user.id) next();
  else
    res.status(403).send('Only the community admin can perform this action.');
});

export const edit = [
  exists,
  isNotReadonly,
  isAdmin,
  ...validation,
  validate,
  asyncHandler(async (req, res) => {
    await commQueries.edit(req.thisCommunity.id, {
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
  else
    res.status(403).send('Only a community moderator can perform this action.');
});

export const getWiki = [
  exists,
  asyncHandler(async (req, res) => {
    res.json({
      wiki: req.thisCommunity.wiki,
    });
  }),
];

export const editWiki = [
  exists,
  isNotReadonly,
  isAdminOrMod,
  body('content').trim().escape(),
  validate,
  asyncHandler(async (req, res) => {
    if (req.body.content === '')
      await commQueries.editWiki(req.thisCommunity.id, null, req.user.id);
    else
      await commQueries.editWiki(
        req.thisCommunity.id,
        req.body.content,
        req.user.id,
      );
    res.sendStatus(200);
  }),
];

export const follow = [
  exists,
  isNotReadonly,
  body('follow').trim().isBoolean().escape(),
  validate,
  asyncHandler(async (req, res) => {
    const followers = await commQueries.findFollowers(req.thisCommunity.id);
    if (
      req.body.follow === 'true' &&
      followers.find(({ id }) => id === req.user.id)
    ) {
      res.status(400).send('You are already following this community.');
    } else if (
      req.body.follow === 'false' &&
      !followers.find(({ id }) => id === req.user.id)
    ) {
      res.status(400).send('You are not following this community.');
    } else {
      await commQueries.follow(
        req.thisCommunity.id,
        req.user.id,
        req.body.follow,
      );
      res.sendStatus(200);
    }
  }),
];

export const editModerators = [
  exists,
  isNotReadonly,
  isAdmin,
  body('type')
    .trim()
    .notEmpty()
    .withMessage('Please choose a promotion or demotion.')
    .bail()
    .isIn(['promote', 'demote'])
    .withMessage('Invalid type.')
    .escape(),
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Please enter a username.')
    .bail()
    .custom(async (value, { req }) => {
      const existingUser = await userQueries.find({ username: value });
      if (!existingUser) {
        throw new Error('No user exists with this username.');
      }
      if (existingUser.id === req.user.id) {
        throw new Error('You cannot promote or demote yourself.');
      }
      if (
        req.body.type === 'promote' &&
        req.thisCommunity.moderators.find(
          ({ id }: { id: number }) => id === existingUser.id,
        )
      )
        throw new Error('This user is already a moderator of this community.');
      if (
        req.body.type === 'demote' &&
        !req.thisCommunity.moderators.find(
          ({ id }: { id: number }) => id === existingUser.id,
        )
      )
        throw new Error('This user is not a moderator of this community.');
      req.thisUser = existingUser;
    })
    .escape(),
  validate,
  asyncHandler(async (req, res) => {
    if (req.body.type === 'demote')
      await commQueries.demoteModerator(req.thisCommunity.id, req.thisUser.id);
    if (req.body.type === 'promote')
      await commQueries.promoteModerator(req.thisCommunity.id, req.thisUser.id);
    res.status(200).json({
      username: req.thisUser.username,
      id: req.thisUser.id,
    });
  }),
];

export const editStatus = [
  exists,
  isAdmin,
  body('readonly').trim().isBoolean().escape(),
  validate,
  asyncHandler(async (req, res) => {
    if (req.thisCommunity.readonly === true && req.body.readonly === 'true')
      res.status(400).send('This community is already readonly.');
    else if (
      req.thisCommunity.readonly === false &&
      req.body.readonly === 'false'
    )
      res.status(400).send('This community is not readonly.');
    else {
      await commQueries.toggleReadonly(req.thisCommunity.id, req.body.readonly);
      res.sendStatus(200);
    }
  }),
];

export const getActions = [
  exists,
  asyncHandler(async (req, res) => {
    const { before, after, take, type } = req.query as Record<
      string,
      string | undefined
    >;

    const { actions, links } = await getForCommunity(
      req.thisCommunity.id,
      {
        before: before ? (parseInt(before, 10) ?? undefined) : undefined,
        after: after ? (parseInt(after, 10) ?? undefined) : undefined,
        take: take ? (parseInt(take, 10) ?? 15) : 30,
      },
      {
        ...(type && { type }),
      },
    );

    res.json({ actions, links });
  }),
];
