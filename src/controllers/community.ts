import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { body, type ValidationChain } from 'express-validator';
import { type User, type Community } from '@prisma/client';

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
  validateFollow: ValidationChain,
  follow: RequestHandler
  validatePromotion: ValidationChain,
  promote: RequestHandler,
  validateDemotion: ValidationChain,
  demote: RequestHandler
} = {
  getAll: asyncHandler(async (req, res) => {
    const { sort, name, page } = req.query;

    let orderBy;
    const pageNumber = parseInt(page as string, 10) % 1 === 0
      ? parseInt(page as string, 10)
      : 1;

    if (sort === 'followers') orderBy = { followers: { _count: 'desc' } };
    if (sort === 'posts') orderBy = { posts: { _count: 'desc' } };
    if (sort === 'activity') orderBy = { lastActivity: 'desc' };

    const communities = await prisma.community.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { canonicalName: { contains: name as string ?? '' } },
          { urlName: { contains: name as string ?? '' } },
        ],
      },
      include: {
        _count: {
          select: {
            followers: true,
            posts: true,
          },
        },
      },
      omit: {
        adminId: true,
        wiki: true,
      },
      // @ts-expect-error this still works despite the type error.
      // + conditionally defining this as an object prior to the query is a lot cleaner than nesting ternaries here
      orderBy,
      skip: (pageNumber - 1) * 20,
      take: 20,
    });
    res.json({
      communities,
      page: pageNumber,
      pages: Math.floor(await prisma.community.count() / 20),
      areYouSignedIn: !!req.user,
    });
  }),

  exists: asyncHandler(async (req, res, next) => {
    let community: Community | null = null;
    const findClause = {
      include: {
        admin: { select: { id: true, username: true } },
        moderators: { select: { id: true, username: true } },
        followers: { select: { id: true, username: true } },
      },
      omit: { adminId: true },
    };

    const id = parseInt(req.params.communityNameOrId, 10);
    if (id % 1 !== 0) {
      community = await prisma.community.findUnique({
        ...findClause, where: { urlName: req.params.communityNameOrId },
      });
    } else {
      community = await prisma.community.findUnique({
        ...findClause, where: { id },
      });
    }

    if (community) {
      req.thisCommunity = community;
      next();
    } else {
      res.sendStatus(404);
    }
  }),

  isAdmin: asyncHandler(async (req, res, next) => {
    if (req.thisCommunity.admin.id !== req.user.id) res.sendStatus(403);
    else next();
  }),

  isMod: asyncHandler(async (req, res, next) => {
    if (
      !req.thisCommunity.moderators.find(
        (mod: { id: number, username: string }) => mod.id === req.user.id,
      )
      && req.thisCommunity.admin.id !== req.user.id
    ) res.sendStatus(403);
    else next();
  }),

  get: asyncHandler(async (req, res) => {
    if (req.thisCommunity.status === 'HIDDEN' && (!req.user || !(req.user.role === 'ADMIN'))) {
      res.sendStatus(404);
    } else {
      res.json({
        ...req.thisCommunity,
        areYouSignedIn: !!req.user,
        areYouMod: !!req.user && req.thisCommunity.moderators.find(
          (mod: { id: number, username: string }) => mod.id === req.user.id,
        ),
        areYouAdmin: !!req.user && req.thisCommunity.admin.id === req.user.id,
      });
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
          select: { id: true },
        });
        if (
          existingCommunity // a community exists
          && !('thisCommunity' in req
            && existingCommunity.id === req.thisCommunity.id) // the existing community is NOT this community
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

  validateFollow: body('follow')
    .trim()
    .isBoolean()
    .escape(),

  follow: asyncHandler(async (req, res) => {
    const { followers } = req.thisCommunity;
    if (req.body.follow === 'true') {
      if (!followers.find((follower: User) => follower.id === req.user.id)) {
        await prisma.community.update({
          where: { id: req.thisCommunity.id },
          data: { followers: { connect: { id: req.user.id } } },
        });
      }
    }
    if (req.body.follow === 'false') {
      if (followers.find((follower: User) => follower.id === req.user.id)) {
        await prisma.community.update({
          where: { id: req.thisCommunity.id },
          data: { followers: { disconnect: { id: req.user.id } } },
        });
      }
    }
    res.sendStatus(200);
  }),

  validatePromotion: body('username')
    .trim()
    .notEmpty().withMessage('Please enter a username.')
    .bail()
    .custom(async (value, { req }) => {
      const existingUser = await prisma.user.findUnique({
        where: { username: value },
        include: { communitiesModeratorOf: true, communitiesAdminOf: true },
      });
      if (!existingUser) { throw new Error('No user exists with this username.'); }
      if (
        existingUser.communitiesAdminOf
          .map((c) => c.id).includes(req.thisCommunity.id)
      ) {
        throw new Error('You cannot promote yourself.');
      }
      if (
        existingUser.communitiesModeratorOf
          .map((c) => c.id).includes(req.thisCommunity.id)
      ) {
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

  validateDemotion: body('username')
    .trim()
    .notEmpty().withMessage('Please enter a username.')
    .bail()
    .custom(async (value, { req }) => {
      const existingUser = await prisma.user.findUnique({
        where: { username: value },
        include: { communitiesModeratorOf: true, communitiesAdminOf: true },
      });
      if (!existingUser) { throw new Error('No user exists with this username.'); }
      if (
        existingUser.communitiesAdminOf
          .map((c) => c.id).includes(req.thisCommunity.id)
      ) {
        throw new Error('You cannot demote yourself.');
      }
      if (
        !existingUser.communitiesModeratorOf
          .map((c) => c.id).includes(req.thisCommunity.id)
      ) {
        throw new Error('This user is not a moderator of this community.');
      }
      req.thisUser = existingUser;
    })
    .escape(),

  demote: asyncHandler(async (req, res) => {
    await prisma.community.update({
      where: { id: req.thisCommunity.id },
      data: {
        moderators: {
          set: req.thisCommunity.moderators.filter(
            (mod: User) => mod.id !== req.thisUser.id,
          ),
        },
      },
    });
    res.sendStatus(200);
  }),
};

export default controller;
