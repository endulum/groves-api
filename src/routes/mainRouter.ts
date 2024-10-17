import express from 'express';
import asyncHandler from 'express-async-handler';
import handleValidationErrors from '../middleware/handleValidationErrors';

import user from '../controllers/user';
import community from '../controllers/community';

const checkIfHit = () => asyncHandler(async (req, res, next) => {
  console.log('hi');
  return next();
});

const router = express.Router();

router.route('/')
  .get(user.deserialize, user.authenticate, async (_req, res) => res.send(200));

// basic

const authUser = [user.deserialize, user.authenticate];
const editAccount = [
  user.validate, handleValidationErrors, user.submit,
];

router.route('/me')
  .get(...authUser, user.getMe)
  .put(...authUser, ...editAccount);
router.route('/user/:userNameOrId')
  .get(user.exists, user.get);

// community

const createCommunity = [
  community.validate, handleValidationErrors, community.create,
];
const editCommunity = [
  community.validate, handleValidationErrors, community.edit,
];
const followCommunity = [
  community.validateFollow, handleValidationErrors, community.follow,
];
const areYouMod = [community.exists, community.isMod];
const areYouAdmin = [community.exists, community.isAdmin];
const promoteUser = [
  community.validatePromotion, handleValidationErrors, community.promote,
];
const demoteUser = [
  community.validateDemotion, handleValidationErrors, community.demote,
];
const editWiki = [
  community.validateWiki, handleValidationErrors, community.editWiki,
];
const freezeOrThaw = [
  community.validateFreeze, handleValidationErrors, community.freezeOrThaw,
];
const communityIsActive = [
  community.exists, community.isActive,
];

router.route('/communities')
  .get(community.getAll)
  .post(...authUser, ...createCommunity);
router.route('/community/:communityNameOrId')
  .get(user.deserialize, community.exists, community.get)
  .put(...authUser, ...communityIsActive, ...areYouAdmin, ...editCommunity);
router.route('/community/:communityNameOrId/follow')
  .post(...authUser, ...communityIsActive, ...followCommunity);
router.route('/community/:communityNameOrId/promote')
  .post(...authUser, ...communityIsActive, ...areYouAdmin, ...promoteUser);
router.route('/community/:communityNameOrId/demote')
  .post(...authUser, ...communityIsActive, ...areYouAdmin, ...demoteUser);
router.route('/community/:communityNameOrId/wiki')
  .put(...authUser, ...communityIsActive, ...areYouMod, ...editWiki);
router.route('/community/:communityNameOrId/freeze')
  .post(...authUser, ...areYouAdmin, ...freezeOrThaw);

export default router;
