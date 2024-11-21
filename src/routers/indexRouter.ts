import express from 'express';
import asyncHandler from 'express-async-handler';

import * as user from '../controllers/user';
import * as community from '../controllers/community';
import * as post from '../controllers/post';

const router = express.Router();

// simple route to return 200 if authenticated and 401 if not
router.route('/').get(
  user.authenticate,
  asyncHandler(async (_req, res) => {
    res.sendStatus(200);
  }),
);

router
  .route('/me')
  .get(user.authenticate, user.me)
  .put(user.authenticate, user.editMe);

router.route('/user/:userNameOrId').get(user.exists, user.get);

router
  .route('/communities')
  .get(community.search)
  .post(user.authenticate, community.newCommunity);

router
  .route('/community/:communityUrlOrId')
  .get(user.deserialize, community.exists, community.get)
  .put(user.authenticate, community.updateCommunity);

router
  .route('/community/:communityUrlOrId/wiki')
  .get(community.exists, community.getWiki)
  .put(user.authenticate, community.editWiki);

router
  .route('/community/:communityUrlOrId/promote')
  .post(user.authenticate, community.promote);

router
  .route('/community/:communityUrlOrId/demote')
  .post(user.authenticate, community.demote);

router
  .route('/community/:communityUrlOrId/follow')
  .post(user.authenticate, community.follow);

router
  .route('/community/:communityUrlOrId/freeze')
  .post(user.authenticate, community.freeze);

router
  .route('/community/:communityUrlOrId/posts')
  .get(post.search)
  .post(user.authenticate, post.newPost);

router
  .route('/post/:postId')
  .get(user.deserialize, post.exists, post.get)
  .put(user.authenticate, post.editPost);

router.route('/post/:postId/freeze').post(user.authenticate, post.freezePost);

router.route('/post/:postId/hide').post(user.authenticate, post.hidePost);

router.route('/post/:postId/upvote').post(user.authenticate, post.upvote);
router.route('/post/:postId/downvote').post(user.authenticate, post.downvote);

export { router };
