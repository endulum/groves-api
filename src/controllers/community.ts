import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { body, type ValidationChain } from 'express-validator';
import { type Community } from '@prisma/client';

import prisma from '../prisma';

const controller: {
  getAll: RequestHandler,
  exists: RequestHandler,
  isAdmin: RequestHandler,
  isMod: RequestHandler,
  get: RequestHandler,
  validate: ValidationChain[],
  create: RequestHandler,
  edit: RequestHandler,
  validatePromotion: ValidationChain,
  promote: RequestHandler,
  // validateDemotion: ValidationChain,
  // demote: RequestHandler
} = {
  getAll: asyncHandler(async (_req, res) => {
    // todo: use query params to filter results
    const communities = await prisma.community.findMany({
      where: { status: 'ACTIVE' },
    });
    res.json(communities);
  }),

  exists: asyncHandler(async (req, res, next) => {
    let community: Community | null = null;
    const include = {
      followers: true,
      admin: true,
      moderators: true,
      posts: true,
    };

    const id = parseInt(req.params.communityNameOrId, 10);
    if (id % 1 !== 0) {
      community = await prisma.community.findUnique({
        where: { urlName: req.params.communityNameOrId }, include,
      });
    } else {
      community = await prisma.community.findUnique({ where: { id }, include });
    }
    if (community) {
      req.thisCommunity = community;
      next();
    } else {
      res.sendStatus(404);
    }
  }),

  isAdmin: asyncHandler(async (req, res, next) => {
    if (req.thisCommunity.adminId !== req.user.id) res.sendStatus(403);
    else next();
  }),

  isMod: asyncHandler(async (req, res, next) => {
    if (
      !req.thisCommunity.moderators.includes(req.user.id)
      && req.thisCommunity.adminId !== req.user.id
    ) res.sendStatus(403);
    else next();
  }),

  get: asyncHandler(async (req, res) => {
    if (req.thisCommunity.status === 'HIDDEN' && (!req.user || !(req.user.role === 'ADMIN'))) {
      res.sendStatus(404);
    } else {
      res.json(req.thisCommunity);
    }
  }),

  validate: [
    body('urlName')
      .trim()
      .notEmpty().withMessage('Please enter a URL name for this community.')
      .bail()
      .isLength({ min: 2, max: 32 })
      .withMessage('Community URL names must be between 2 and 32 characters long.')
      .bail()
      .matches(/^[a-z0-9]+$/g)
      .withMessage('Community URL names must only contain lowercase and numbers.')
      .bail()
      .custom(async (value, { req }) => {
        const existingCommunity = await prisma.community.findUnique({
          where: { urlName: value },
        });
        if (
          existingCommunity
          && !('thisCommunity' in req
            && existingCommunity.id === req.thisCommunity.id)
        ) {
          throw new Error('A community with this URL name already exists. Community URLs must be unique.');
        }
      })
      .escape(),
    body('canonicalName')
      .trim()
      .notEmpty().withMessage('Please enter a canonical name for this community.')
      .bail()
      .isLength({ min: 2, max: 32 })
      .withMessage('Community canonical names must be between 2 and 32 characters long.')
      .escape(),
    body('description')
      .trim()
      .notEmpty().withMessage('Please enter a description for this community.')
      .bail()
      .isLength({ min: 2, max: 200 })
      .withMessage('Community descriptions cannot exceed 200 charatcers.')
      .escape(),
  ],

  create: asyncHandler(async (req, res) => {
    await prisma.community.create({
      data: {
        adminId: req.user.id,
        urlName: req.body.urlName,
        canonicalName: req.body.canonicalName,
        description: req.body.description,
        status: 'ACTIVE',
      },
    });
    res.sendStatus(200);
  }),

  edit: asyncHandler(async (req, res) => {
    await prisma.community.update({
      where: {
        id: req.thisCommunity.id,
      },
      data: {
        urlName: req.body.urlName,
        canonicalName: req.body.canonicalName,
        description: req.body.description,
      },
    });
    res.sendStatus(200);
  }),

  validatePromotion: body('username')
    .trim()
    .notEmpty().withMessage('Please enter a username.')
    .bail()
    .custom(async (value, { req }) => {
      const existingUser = await prisma.user.findUnique({
        where: { username: value },
        include: { moderatorOf: true, adminOf: true },
      });
      if (!existingUser) { throw new Error('No user exists with this username.'); }
      if (existingUser.adminOf.map((c) => c.id).includes(req.thisCommunity.id)) {
        throw new Error('You cannot promote yourself.');
      }
      if (existingUser.moderatorOf.map((c) => c.id).includes(req.thisCommunity.id)) {
        throw new Error('This user is already a moderator of this community.');
      }
      req.thisUser = existingUser;
    })
    .escape(),

  promote: asyncHandler(async (req, res) => {
    await prisma.community.update({
      where: { id: req.thisCommunity.id },
      data: {
        moderators: {
          connect: { id: req.thisUser.id },
        },
      },
    });
    res.sendStatus(200);
  }),
};

export default controller;
