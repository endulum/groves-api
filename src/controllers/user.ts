import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import jsonwebtoken from 'jsonwebtoken';

import prisma from '../prisma';

interface IJwtPayload extends jsonwebtoken.JwtPayload {
  id: string
}

const controller: {
  deserialize: RequestHandler,
  exists: RequestHandler,
  get: RequestHandler
} = {
  deserialize: asyncHandler(async (req, res, next) => {
    const bearerHeader = req.headers.authorization;
    const bearerToken = bearerHeader?.split(' ')[1];

    if (bearerToken === undefined) {
      res.sendStatus(401);
      return;
    }

    let decoded;
    try {
      if (!process.env.TOKEN_SECRET) throw new Error('Secret is not defined.');
      decoded = jsonwebtoken.verify(bearerToken, process.env.TOKEN_SECRET) as IJwtPayload;
      const user = await prisma.user.findUnique({
        where: { id: parseInt(decoded.id, 10) },
      });
      if (!user) {
        res.sendStatus(404);
      } else {
        req.user = user;
        next();
      }
    } catch {
      res.sendStatus(401);
    }
  }),

  exists: asyncHandler(async (req, res, next) => {
    const id = parseInt(req.params.userId, 10);
    if (id % 1 !== 0) {
      res.sendStatus(404);
    } else {
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        res.sendStatus(404);
      } else {
        req.thisUser = user;
        next();
      }
    }
  }),

  get: asyncHandler(async (req, res) => {
    res.json({
      username: req.thisUser.username,
      id: req.thisUser.id,
      role: req.thisUser.role,
    });
  }),
};

export default controller;
