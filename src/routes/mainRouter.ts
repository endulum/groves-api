import express from 'express';
import asyncHandler from 'express-async-handler';
import handleValidationErrors from '../middleware/handleValidationErrors';

import account from '../controllers/account';
import user from '../controllers/user';

const router = express.Router();

router.route('/')
  .get(user.deserialize, asyncHandler(async (req, res) => {
    res.json(req.user);
  }));

router.route('/user/:userId')
  .get(user.exists, user.get);

router.route('/account')
  .post(user.deserialize, account.validate, handleValidationErrors, account.submit);

export default router;
