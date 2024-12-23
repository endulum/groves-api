import asyncHandler from 'express-async-handler';
import { body } from 'express-validator';
import jwt from 'jsonwebtoken';

import * as userQueries from '../../prisma/queries/user';
import { validate } from '../middleware/validate';

// is imported at user controller for username changing
export const usernameValidation = body('username')
  .trim()
  .notEmpty()
  .withMessage('Please enter a username.')
  .bail()
  .isLength({ min: 2, max: 32 })
  .withMessage('Usernames must be between 2 and 32 characters long.')
  .matches(/^[a-z0-9-]+$/g)
  .withMessage(
    'Username must only consist of lowercase letters, numbers, and hyphens.',
  )
  .custom(async (value, { req }) => {
    if (parseInt(value, 10) % 1 === 0)
      throw new Error('Usernames cannot be made solely of numbers.');
    const existingUser = await userQueries.find({ username: value });
    if (existingUser && !('user' in req && existingUser.id === req.user.id)) {
      throw new Error(
        'A user with this username already exists. Usernames must be unique.',
      );
    }
  })
  .escape();

const isNotLoggedIn = asyncHandler(async (req, res, next) => {
  if (!req.user) next();
  else res.status(403).send('You cannot perform this action when logged in.');
});

export const signup = [
  isNotLoggedIn,
  usernameValidation,
  body('password')
    .trim()
    .notEmpty()
    .withMessage('Please enter a password.')
    .bail()
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long.')
    .escape(),
  body('confirmPassword')
    .trim()
    .notEmpty()
    .withMessage('Please confirm your password.')
    .bail()
    .custom(async (value, { req }) => {
      if (req.body.password !== '' && value !== req.body.password) {
        throw new Error('Both passwords do not match.');
      }
    })
    .escape(),
  validate,
  asyncHandler(async (req, res) => {
    await userQueries.create({
      username: req.body.username,
      password: req.body.password,
    });
    res.sendStatus(200);
  }),
];

export const login = [
  isNotLoggedIn,
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Please enter a username.')
    .escape(),
  body('password')
    .trim()
    .notEmpty()
    .withMessage('Please enter a password.')
    .bail()
    .custom(async (value, { req }) => {
      if (!req.body.username) return;
      const user = await userQueries.find({ username: req.body.username });
      if (!user) throw new Error('Incorrect username or password.');
      const match = await userQueries.comparePassword({
        userData: user,
        password: value,
      });
      if (!match) throw new Error('Incorrect username or password.');
      req.user = user;
    })
    .escape(),
  validate,
  asyncHandler(async (req, res) => {
    if (!process.env.TOKEN_SECRET)
      throw new Error('Token secret is not defined.');
    const token = jwt.sign(
      { username: req.user.username, id: req.user.id },
      process.env.TOKEN_SECRET,
    );
    res.json({ token });
  }),
];
