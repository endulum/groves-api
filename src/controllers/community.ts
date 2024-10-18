import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { body, type ValidationChain } from 'express-validator';
import { Prisma, type Status, type User } from '@prisma/client';
import bcrypt from 'bcryptjs';

import prisma from '../prisma';

const controller: {
  getAll: RequestHandler,
  exists: RequestHandler,
  isActive: RequestHandler,
  isAdmin: RequestHandler,
  isMod: RequestHandler,
  get: RequestHandler,
  getActions: RequestHandler,

  validate: ValidationChain[],
  create: RequestHandler,
  edit: RequestHandler,

  validateFollow: ValidationChain,
  follow: RequestHandler

  validatePromotion: ValidationChain,
  promote: RequestHandler,

  validateDemotion: ValidationChain,
  demote: RequestHandler,

  validateWiki: ValidationChain,
  editWiki: RequestHandler,

  validateFreeze: ValidationChain,
  freezeOrThaw: RequestHandler
} = {
  getAll: asyncHandler(async (req, res) => {
    const { sort, name, page } = req.query;

    let order;
    const pageNumber = parseInt(page as string, 10) % 1 === 0
      ? parseInt(page as string, 10)
      : 1;

    if (sort === 'followers') order = { followers: { _count: 'desc' } };
    if (sort === 'posts') order = { posts: { _count: 'desc' } };
    if (sort === 'activity') order = { lastActivity: 'desc' };

    const orderBy = Prisma.validator<Prisma.CommunityOrderByWithRelationInput>()({
      ...order,
    });

    const query = {
      where: {
        status: 'ACTIVE' as Status,
        OR: [
          { canonicalName: { contains: name as string ?? '' } },
          { urlName: { contains: name as string ?? '' } },
        ],
      },
    };

    const queryForSearching = Prisma.validator<Prisma.CommunityFindManyArgs>()({
      ...query,
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
      orderBy,
    });
    const queryForCounting = Prisma.validator<Prisma.CommunityCountArgs>()(query);

    const communitiesFound = await prisma.community.findMany({
      ...queryForSearching,
      skip: (pageNumber - 1) * 20,
      take: 20,
    });
    const totalCommunities = await prisma.community.count({
      ...queryForCounting,
    });

    res.json({
      communities: communitiesFound,
      page: pageNumber,
      pages: Math.max(Math.floor(totalCommunities / 20), 1),
    });
  }),

  exists: asyncHandler(async (req, res, next) => {
    const id = parseInt(req.params.communityNameOrId, 10);
    const where = (id % 1 !== 0)
      ? { urlName: req.params.communityNameOrId }
      : { id };

    // const { actionName } = req.query;

    const community = await prisma.community.findFirst({
      where,
      include: {
        admin: { select: { id: true, username: true } },
        moderators: { select: { id: true, username: true } },
        followers: { select: { id: true, username: true } },
      },
      omit: { adminId: true },
    });

    if (community) {
      req.thisCommunity = community;
      next();
    } else {
      res.sendStatus(404);
    }
  }),

  isActive: asyncHandler(async (req, res, next) => {
    if (req.thisCommunity.status === 'FROZEN') {
      res.sendStatus(403);
      return;
    }
    next();
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
        areYouMod: !!req.user && req.thisCommunity.moderators.find(
          (mod: { id: number, username: string }) => mod.id === req.user.id,
        ),
        areYouAdmin: !!req.user && req.thisCommunity.admin.id === req.user.id,
      });
    }
  }),

  getActions: asyncHandler(async (req, res) => {
    if (req.thisCommunity.status === 'HIDDEN' && (!req.user || !(req.user.role === 'ADMIN'))) {
      res.sendStatus(404);
    } else {
      const {
        text, before, after, page,
      } = req.query;

      const pageNumber = parseInt(page as string, 10) % 1 === 0
        ? parseInt(page as string, 10)
        : 1;

      const dateClause = [];
      if (Number(Date.parse(before as string))) {
        dateClause.push({
          date: { lte: new Date(Date.parse(before as string)).toISOString() },
        });
      }

      if (Number(Date.parse(after as string))) {
        dateClause.push({
          date: { gte: new Date(Date.parse(after as string)).toISOString() },
        });
      }

      const query = {
        where: {
          communityId: req.thisCommunity.id,
          activity: { contains: text as string ?? '' },
          AND: dateClause,
        },
      };

      const queryForSearching = Prisma.validator<Prisma.ActionFindManyArgs>()(query);
      const queryForCounting = Prisma.validator<Prisma.ActionCountArgs>()(query);

      const actionsFound = await prisma.action.findMany({
        ...queryForSearching,
        orderBy: {
          date: 'desc',
        },
        skip: (pageNumber - 1) * 50,
        take: 50,
      });

      const totalActions = await prisma.action.count({
        ...queryForCounting,
      });

      res.json({
        actions: actionsFound,
        page: pageNumber,
        pages: Math.max(Math.floor(totalActions / 50), 1),
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
    const newCommunity = await prisma.community.create({
      data: {
        adminId: req.user.id,
        urlName: req.body.urlName,
        canonicalName: req.body.canonicalName,
        description: req.body.description,
        status: 'ACTIVE',
      },
    });

    await prisma.action.create({
      data: {
        activity: `User #${req.user.id} created this community.`,
        communityId: newCommunity.id,
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

    await prisma.action.create({
      data: {
        activity: `User #${req.user.id} edited this community's details.`,
        communityId: req.thisCommunity.id,
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

    await prisma.action.create({
      data: {
        activity: `User #${req.user.id} promoted User #${req.thisUser.id} to Moderator.`,
        communityId: req.thisCommunity.id,
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

    await prisma.action.create({
      data: {
        activity: `User #${req.user.id} demoted User #${req.thisUser.id} from Moderator.`,
        communityId: req.thisCommunity.id,
      },
    });

    res.sendStatus(200);
  }),

  validateWiki: body('wiki')
    .trim()
    .escape(),

  editWiki: asyncHandler(async (req, res) => {
    await prisma.community.update({
      where: { id: req.thisCommunity.id },
      data: { wiki: req.body.wiki ?? '' },
    });

    await prisma.action.create({
      data: {
        activity: `User #${req.user.id} made changes to this community's Wiki.`,
        communityId: req.thisCommunity.id,
      },
    });
    res.sendStatus(200);
  }),

  validateFreeze: body('password')
    .notEmpty().withMessage('Please enter your password.').bail()
    .custom(async (value, { req }) => {
      const match = await bcrypt.compare(value, req.user.password);
      if (!match) throw new Error('Incorrect username or password.');
    })
    .escape(),

  freezeOrThaw: asyncHandler(async (req, res) => {
    const isFrozen = req.thisCommunity.status === 'FROZEN';
    await prisma.community.update({
      where: { id: req.thisCommunity.id },
      data: { status: isFrozen ? 'ACTIVE' : 'FROZEN' },
    });

    await prisma.action.create({
      data: {
        activity: `User #${req.user.id} ${isFrozen ? 'thawed' : 'froze'} this community.`,
        communityId: req.thisCommunity.id,
      },
    });

    res.sendStatus(200);
  }),
};

export default controller;
