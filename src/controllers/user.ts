import asyncHandler from 'express-async-handler';
import { body } from 'express-validator';
import jwt from 'jsonwebtoken';

import * as userQueries from '../../prisma/queries/user';
import { getForUser } from '../../prisma/queries/action';
import { getForUser as getVerdancy } from '../../prisma/queries/verdancy';
import { usernameValidation } from './auth';
import { validate } from '../middleware/validate';

export const deserialize = asyncHandler(async (req, _res, next) => {
  const bearerHeader = req.headers.authorization;
  const bearerToken = bearerHeader?.split(' ')[1];
  if (bearerToken === undefined || bearerToken === 'undefined') return next();

  try {
    if (!process.env.TOKEN_SECRET) throw new Error('Secret is not defined.');
    const { id } = jwt.verify(bearerToken, process.env.TOKEN_SECRET) as {
      id: number;
    };
    const user = await userQueries.find({ id });
    req.user = user;
  } catch (err) {
    console.error(err);
  }
  return next();
});

export const authenticate = [
  deserialize,
  asyncHandler(async (req, res, next) => {
    if (!req.user) {
      res.status(401).send('Please log in.');
    } else {
      next();
    }
  }),
];

export const edit = [
  ...authenticate,
  usernameValidation,
  body('bio')
    .trim()
    .isLength({ max: 200 })
    .withMessage('Bios cannot be more than 200 characters long.')
    .escape(),
  body('password')
    .trim()
    .custom(async (value) => {
      if (value.length > 0 && value.length < 8)
        throw new Error('New password must be 8 or more characters long.');
    })
    .escape(),
  body('confirmPassword')
    .trim()
    .custom(async (value, { req }) => {
      if (req.body.password !== '' && value.length === 0)
        throw new Error('Please confirm your new password.');
    })
    .bail()
    .custom(async (value, { req }) => {
      if (req.body.password !== '' && value !== req.body.password)
        throw new Error('Both passwords do not match.');
    })
    .escape(),
  body('currentPassword')
    .trim()
    .custom(async (value, { req }) => {
      if (req.body.password !== '') {
        if (value.length === 0)
          throw new Error(
            'Please enter your current password in order to change it.',
          );
        const match = await userQueries.comparePassword({
          userData: req.user,
          password: value,
        });
        if (!match) throw new Error('Incorrect password.');
      }
    })
    .escape(),
  validate,
  asyncHandler(async (req, res) => {
    await userQueries.update({ userData: req.user, body: req.body });
    res.sendStatus(200);
  }),
];

export const exists = asyncHandler(async (req, res, next) => {
  const user = await userQueries.find({
    username: req.params.user,
    id: parseInt(req.params.user, 10),
  });
  if (user) {
    req.thisUser = user;
    next();
  } else res.status(404).send('User could not be found.');
});

export const get = [
  exists,
  asyncHandler(async (req, res) => {
    const verdancy = await getVerdancy(req.thisUser.id);
    delete req.thisUser.password;
    res.json({
      ...req.thisUser,
      verdancy,
    });
  }),
];

export const getActions = [
  exists,
  asyncHandler(async (req, res) => {
    const { before, after, take } = req.query as Record<
      string,
      string | undefined
    >;

    const { actions, links } = await getForUser(req.thisUser.id, {
      before: before ? (parseInt(before, 10) ?? undefined) : undefined,
      after: after ? (parseInt(after, 10) ?? undefined) : undefined,
      take: take ? (parseInt(take, 10) ?? 10) : 10,
    });

    res.json({ actions, links });
  }),
];

export const me = [
  ...authenticate,
  asyncHandler(async (req, res) => {
    delete req.user.password;
    res.json(req.user);
  }),
];
