import asyncHandler from 'express-async-handler';
import { body } from 'express-validator';
import jwt from 'jsonwebtoken';

import * as userQueries from '../../prisma/queries/user';
import { validate } from '../middleware/validate';
import { ofetch } from 'ofetch';
import { parse } from 'querystring';

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

const signToken = async (id: number, username: string) => {
  if (!process.env.JWT_SECRET) throw new Error('JWT secret is not defined.');
  const token = jwt.sign({ username, id }, process.env.JWT_SECRET);
  return token;
};

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
    res.json({
      token: await signToken(req.user.id, req.user.username),
    });
  }),
];

const exchangeCodeForToken = async (code: string) => {
  const { access_token } = await ofetch(
    'https://github.com/login/oauth/access_token',
    {
      method: 'get',
      params: {
        client_id: process.env.GH_CLIENT_ID,
        client_secret: process.env.GH_SECRET,
        redirect_uri: `${process.env.FRONTEND_URL}/github`,
        code,
      },
      parseResponse: (response) => parse(response),
    },
  );
  return access_token;
};

const fetchGithubUser = async (accessToken: string) => {
  const data = await ofetch('https://api.github.com/user', {
    method: 'get',
    headers: {
      Authorization: `token ${accessToken}`,
    },
  });
  return data;
};

export const github = asyncHandler(async (req, res) => {
  const { code } = req.query as Record<string, string | null>;
  if (!code || code === 'undefined') {
    res.status(400).send('No code is provided.');
    return;
  }
  const accessToken = await exchangeCodeForToken(code);
  const githubUser = await fetchGithubUser(accessToken);

  let username = '';
  let id = 0;
  const existingUser = await userQueries.find({ githubId: githubUser.id });
  if (existingUser) {
    username = existingUser.username;
    id = existingUser.id;
    await userQueries.updateGithubUser(id, githubUser.login);
  } else {
    const newUserId = await userQueries.create({
      username: githubUser.login,
      githubId: githubUser.id,
      githubUser: githubUser.login,
    });
    username = githubUser.login;
    id = newUserId as number;
  }

  res.json({
    token: await signToken(id, username),
  });
});
