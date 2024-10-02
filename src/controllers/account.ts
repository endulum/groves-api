import { ValidationChain, body } from 'express-validator';
import asyncHandler from 'express-async-handler';
import { RequestHandler } from 'express';
import bcrypt from 'bcryptjs';

import usernameValidation from '../common/usernameValidation';
import prisma from '../prisma';

const controller: {
  validate: ValidationChain[],
  submit: RequestHandler
} = {
  validate: [
    usernameValidation,
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
