import express from 'express';
import asyncHandler from 'express-async-handler';
import handleValidationErrors from '../middleware/handleValidationErrors';

import account from '../controllers/account';
import user from '../controllers/user';
import community from '../controllers/community';

const router = express.Router();

const editAccountDetails = [account.validate, handleValidationErrors, account.submit];
const createCommunity = [community.validate, handleValidationErrors, community.create];
const editCommunity = [community.validate, handleValidationErrors, community.edit];

router.route('/')
  .get(user.deserialize, asyncHandler(async (req, res) => {
    res.json(req.user);
  }));

router.route('/user/:userNameOrId')
  .get(user.exists, user.get);

router.route('/account')
  .post(user.deserialize, user.authenticate, ...editAccountDetails);

router.route('/communities')
  .get(community.getAll)
  .post(user.deserialize, user.authenticate, ...createCommunity);

router.route('/community/:communityNameOrId')
  .get(user.deserialize, community.exists, community.get)
  .put(user.deserialize, community.exists, community.isModOrAdminOf, ...editCommunity);

export default router;
