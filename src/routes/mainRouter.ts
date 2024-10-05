import express from 'express';
import asyncHandler from 'express-async-handler';
import handleValidationErrors from '../middleware/handleValidationErrors';

import account from '../controllers/account';
import user from '../controllers/user';
import community from '../controllers/community';

const router = express.Router();

// grouping similar middleware here
const authUser = [user.deserialize, user.authenticate];
const editAccount = [
  account.validate, handleValidationErrors, account.submit,
];
const createCommunity = [
  community.validate, handleValidationErrors, community.create,
];
const editCommunity = [
  community.validate, handleValidationErrors, community.edit,
];
const areYouMod = [community.exists, community.isMod];
const areYouAdmin = [community.exists, community.isAdmin];
const promoteUser = [
  community.validatePromotion, handleValidationErrors, community.promote,
];
const demoteUser = [
  community.validateDemotion, handleValidationErrors, community.demote,
];
// const editCommunityWiki = [
//   community.validateWiki, handleValidationErrors, community.editWiki
// ]

// index
router.route('/')
  .get(...authUser, asyncHandler(async (req, res) => {
    res.json(req.user);
  }));

// accounts
router.route('/user/:userNameOrId')
  .get(user.exists, user.get);
router.route('/account')
  .post(...authUser, ...editAccount);

// communities
router.route('/communities')
  .get(community.getAll)
  .post(...authUser, ...createCommunity);
router.route('/community/:communityNameOrId')
  .get(user.deserialize, community.exists, community.get)
  .put(...authUser, ...areYouMod, ...editCommunity);
router.route('/community/:communityNameOrId/promote')
  .post(...authUser, ...areYouAdmin, ...promoteUser);
router.route('/community/:communityNameOrId/demote')
  .post(...authUser, ...areYouAdmin, ...demoteUser);
// router.route('/community/:communityNameOrId/wiki')
//   .get(community.exists, community.getWiki)
//   .post(...authUser, ...areYouMod, community.editWiki)
// router.route('/community/:communityNameOrId/freeze')
//   .post(...authUser, ...areYouAdmin, community.freeze)

export default router;
