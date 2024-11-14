import express from 'express';
import asyncHandler from 'express-async-handler';

import * as user from '../controllers/user';
// import * as community from '../controllers/community';

const router = express.Router();

// simple route to return 200 if authenticated and 401 if not
router.route('/')
  .get(user.authenticate, asyncHandler(async (_req, res) => { res.sendStatus(200); }));

router.route('/me')
  .get(user.authenticate, user.me)
  .put(user.authenticate, user.editMe);

router.route('/user/:userNameOrId')
  .get(user.exists, user.get);

// router.route('/communities')
//   .get(community.list);

export { router };
