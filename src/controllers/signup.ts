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
      .notEmpty().withMessage('Please enter a password.')
      .bail()
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long.')
      .escape(),

    body('confirmPassword')
      .trim()
      .notEmpty().withMessage('Please confirm your password.')
      .bail()
      .custom(async (value, { req }) => {
        if (req.body.password !== '' && value !== req.body.password) throw new Error('Both passwords do not match.');
      })
      .escape(),

    body('deleteAfter')
      .trim()
      .isBoolean()
      .escape(),
  ],

  submit: asyncHandler(async (req, res) => {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASS as string, salt);
    await prisma.user.create({
      data: {
        username: req.body.username,
        password: hashedPassword,
      },
    });
    res.sendStatus(200);
  }),
};

export default controller;
