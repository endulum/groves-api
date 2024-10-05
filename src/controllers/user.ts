import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import jsonwebtoken from 'jsonwebtoken';

import { Post, User } from '@prisma/client';
import prisma from '../prisma';

interface IJwtPayload extends jsonwebtoken.JwtPayload {
  id: string
}

const controller: {
  deserialize: RequestHandler,
  authenticate: RequestHandler,
  exists: RequestHandler,
  get: RequestHandler
} = {
  deserialize: asyncHandler(async (req, _res, next) => {
    const bearerHeader = req.headers.authorization;
    const bearerToken = bearerHeader?.split(' ')[1];

    if (bearerToken === undefined) return next();

    let decoded;
    try {
      if (!process.env.TOKEN_SECRET) throw new Error('Secret is not defined.');
      decoded = jsonwebtoken.verify(
        bearerToken,
        process.env.TOKEN_SECRET,
      ) as IJwtPayload;
      const user = await prisma.user.findUnique({
        where: { id: parseInt(decoded.id, 10) },
      });
      req.user = user;
    } catch (err) {
      console.error(err);
      req.user = null;
    }

    return next();
  }),

  authenticate: asyncHandler(async (req, res, next) => {
    if (!req.user) {
      res.sendStatus(401);
    } else {
      next();
    }
  }),

  exists: asyncHandler(async (req, res, next) => {
    let user: User | null = null;
    const include = {
      communitiesFollowed: true,
      adminOf: true,
      moderatorOf: true,
      posts: true,
      comments: true,
    };

    const id = parseInt(req.params.userNameOrId, 10);
    if (id % 1 !== 0) {
      user = await prisma.user.findUnique({
        where: { username: req.params.userNameOrId }, include,
      });
    } else {
      user = await prisma.user.findUnique({ where: { id }, include });
    }
    if (user) {
      req.thisUser = user;
      next();
    } else {
      res.sendStatus(404);
    }
  }),

  get: asyncHandler(async (req, res) => {
    const verdancy = req.thisUser.posts
      .concat(req.thisUser.comments)
      .reduce((acc: number, curr: Post) => {
        const total = curr.upvotes - curr.downvotes;
        return total > 0 ? acc + total : acc + 0;
      }, 0);
    res.json({
      username: req.thisUser.username,
      id: req.thisUser.id,
      joined: req.thisUser.joined,
      bio: req.thisUser.bio,
      verdancy,
      role: req.thisUser.role,
    });
  }),
};

export default controller;
