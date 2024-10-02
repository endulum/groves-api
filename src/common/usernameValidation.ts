import { body } from 'express-validator';
import prisma from '../prisma';

const usernameValidation = body('username')
  .trim()
  .notEmpty().withMessage('Please enter a username.')
  .bail()
  .isLength({ min: 2, max: 32 })
  .withMessage('Usernames must be between 2 and 32 characters long.')
  .matches(/^[a-z0-9-]+$/g)
  .withMessage('Username must only consist of lowercase letters, numbers, and hyphens.')
  .custom(async (value, { req }) => {
    const existingUser = await prisma.user.findUnique({
      where: { username: value },
    });
    if (existingUser && !('user' in req && existingUser.id === req.user.id)) {
      throw new Error(
        'A user with this username already exists. Usernames must be unique.',
      );
    }
  })
  .escape();

export default usernameValidation;
