import asyncHandler from 'express-async-handler';
import { body } from 'express-validator';
import jwt from 'jsonwebtoken';

import * as queries from '../../prisma/queries';
import { usernameValidation } from './auth';
import { validate } from '../middleware/validate';

// use the incoming jwt to define req.user
// for routes where req.user may or may not exist
export const deserialize = asyncHandler(async (req, _res, next) => {
  const bearerHeader = req.headers.authorization;
  const bearerToken = bearerHeader?.split(' ')[1];
  if (bearerToken === undefined) return next();

  try {
    if (!process.env.TOKEN_SECRET) throw new Error('Secret is not defined.');
    const { id } = jwt.verify(bearerToken, process.env.TOKEN_SECRET) as {
      id: number;
    };
    const user = await queries.findUser({ id });
    req.user = user;
  } catch (err) {
    console.error(err);
  }

  return next();
});

// check if req.user is defined
// for routes that require req.user to be defined
export const authenticate = [
  deserialize,
  asyncHandler(async (req, res, next) => {
    if (!req.user) {
      res.sendStatus(401);
    } else {
      next();
    }
  }),
];

// edit self details
export const editMe = [
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
        const match = await queries.comparePassword(req.user, value);
        if (!match) throw new Error('Incorrect password.');
      }
    })
    .escape(),

  validate,

  asyncHandler(async (req, res) => {
    await queries.updateUser({ username: req.user.username }, req.body);
    res.sendStatus(200);
  }),
];

// imported to any controllers that need the `userNameOrId` param.
// checks if user by that id exists, sets req.thisUser to existing user,
// returns 404 if user not found
export const exists = asyncHandler(async (req, res, next) => {
  const user = await queries.findUser({
    username: req.params.userNameOrId,
    id: parseInt(req.params.userNameOrId, 10),
  });
  if (user) {
    req.thisUser = user;
    next();
  } else res.sendStatus(404);
});

// respond with data, omitting username
export const get = asyncHandler(async (req, res) => {
  delete req.thisUser.password;
  res.json(req.thisUser);
});

// if getting self details, just set thisUser to the auth user
export const me = [
  asyncHandler(async (req, _res, next) => {
    req.thisUser = req.user;
    next();
  }),
  get,
];
