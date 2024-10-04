import express from 'express';
import asyncHandler from 'express-async-handler';
import handleValidationErrors from '../middleware/handleValidationErrors';

import account from '../controllers/account';
import user from '../controllers/user';
import community from '../controllers/community';

const router = express.Router();

router.route('/')
  .get(user.deserialize, asyncHandler(async (req, res) => {
    res.json(req.user);
  }));

router.route('/user/:userNameOrId')
  .get(user.exists, user.get);

router.route('/account')
  .post(user.deserialize, account.validate, handleValidationErrors, account.submit);

router.route('/communities')
  .get(community.getAll);

router.route('/community/:communityNameOrId')
  .get(community.exists, community.get);

export default router;
