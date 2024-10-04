import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';

import { Community } from '@prisma/client';
import prisma from '../prisma';

const controller: {
  getAll: RequestHandler,
  exists: RequestHandler,
  get: RequestHandler
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

  get: asyncHandler(async (req, res) => {
    if (req.thisCommunity.status === 'HIDDEN' && (!req.user || !(req.user.role === 'ADMIN'))) {
      res.sendStatus(404);
    } else {
      res.json(req.thisCommunity);
    }
  }),
};

export default controller;
