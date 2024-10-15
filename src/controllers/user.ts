import { RequestHandler } from 'express';
import asyncHandler from 'express-async-handler';
import { body, type ValidationChain } from 'express-validator';
import jsonwebtoken from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

import {
  type Prisma, type Post, type User, type Reply,
} from '@prisma/client';
import usernameValidation from '../common/usernameValidation';
import prisma from '../prisma';

interface IJwtPayload extends jsonwebtoken.JwtPayload {
  id: string
}

function getUserInfo(user: Prisma.UserGetPayload<{
  include: {
    posts: true,
    replies: true
  }
}>) {
  const verdancy = [...user.posts, ...user.replies]
    .reduce((acc: number, curr: Post | Reply) => {
      const total = curr.upvotes - curr.downvotes;
      return total > 0 ? acc + total : acc + 0;
    }, 0);

  return ({
    username: user.username,
    id: user.id,
    joined: user.joined,
    bio: user.bio,
    verdancy,
    role: user.role,
  });
}

const controller: {
  deserialize: RequestHandler,
  authenticate: RequestHandler,
  exists: RequestHandler,
  get: RequestHandler,
  getMe: RequestHandler,
  validate: ValidationChain[],
  submit: RequestHandler
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
        include: {
          communitiesFollowing: true,
          communitiesAdminOf: true,
          communitiesModeratorOf: true,
          posts: true,
          replies: true,
        },
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
      communitiesFollowing: true,
      communitiesAdminOf: true,
      communitiesModeratorOf: true,
      posts: true,
      replies: true,
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
    res.json(getUserInfo(req.thisUser));
  }),

  getMe: asyncHandler(async (req, res) => {
    res.json(getUserInfo(req.user));
  }),

  validate: [
    usernameValidation,
    body('bio')
      .trim()
      .isLength({ max: 200 }).withMessage('Bios cannot be more than 200 characters long.')
      .escape(),
    body('password')
      .trim()
      .custom(async (value) => {
        if (value.length > 0 && value.length < 8) throw new Error('New password must be 8 or more characters long.');
      })
      .escape(),
    body('confirmPassword')
      .trim()
      .custom(async (value, { req }) => {
        if (req.body.password !== '' && value.length === 0) throw new Error('Please confirm your new password.');
      }).bail()
      .custom(async (value, { req }) => {
        if (req.body.password !== '' && value !== req.body.password) throw new Error('Both passwords do not match.');
      })
      .escape(),
    body('currentPassword')
      .trim()
      .custom(async (value, { req }) => {
        if (req.body.password !== '') {
          if (value.length === 0) throw new Error('Please enter your current password in order to change it.');
          const match = await bcrypt.compare(req.body.currentPassword, req.user.password);
          if (!match) throw new Error('Incorrect password.');
        }
      })
      .escape(),
  ],

  submit: asyncHandler(async (req, res) => {
    if (!req.user) {
      res.sendStatus(401); return;
    }
    if (req.body.password !== '') {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(req.body.password, salt);
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          username: req.body.username,
          password: hashedPassword,
        },
      });
    } else {
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          username: req.body.username,
        },
      });
    }

    res.sendStatus(200);
  }),
};

export default controller;
