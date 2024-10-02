import { ValidationChain, body } from 'express-validator';
import asyncHandler from 'express-async-handler';
import { RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

import prisma from '../prisma';

const controller: {
  validate: ValidationChain[],
  submit: RequestHandler
} = {
  validate: [
    body('username')
      .trim()
      .notEmpty().withMessage('Please enter a username.')
      .escape(),
    body('password')
      .trim()
      .notEmpty().withMessage('Please enter a password.')
      .bail()
      .custom(async (value, { req }) => {
        if (req.body.username === '') return;
        const user = await prisma.user.findUnique({
          where: { username: req.body.username },
        });
        if (!user) throw new Error('Incorrect username or password.');
        const match = await bcrypt.compare(value, user.password);
        if (!match) throw new Error('Incorrect username or password.');
        req.user = user;
      })
      .escape(),
  ],

  submit: asyncHandler(async (req, res) => {
    if (!process.env.TOKEN_SECRET) throw new Error('Token secret is not defined.');
    const token = jwt.sign(req.user, process.env.TOKEN_SECRET);
    res.json({ token });
  }),
};

export default controller;
