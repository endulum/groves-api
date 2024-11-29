import express from 'express';
import * as auth from './controllers/auth';
import * as user from './controllers/user';
import * as community from './controllers/community';
import * as post from './controllers/post';
import * as reply from './controllers/reply';

const router = express.Router();

// account

router.route('/login').post(auth.login);

router.route('/signup').post(auth.signup);

router.route('/me').get(user.me).put(user.edit);

router.route('/user/:user').get(user.get);

// communities

router
  .route('/communities')
  .get(community.search)
  .post(user.authenticate, community.create);

router
  .route('/community/:community')
  .get(community.get)
  .put(user.authenticate, community.edit);

router
  .route('/community/:community/wiki')
  .get(community.getWiki)
  .put(user.authenticate, community.editWiki);

router
  .route('/community/:community/follow')
  .post(user.authenticate, community.follow);

router
  .route('/community/:community/promote')
  .post(user.authenticate, community.promote);

router
  .route('/community/:community/demote')
  .post(user.authenticate, community.demote);

router
  .route('/community/:community/freeze')
  .post(user.authenticate, community.freeze);

// posts

router
  .route('/community/:community/posts')
  .get(post.search)
  .post(user.authenticate, post.create);

router
  .route('/post/:post')
  .get(user.deserialize, post.get)
  .put(user.authenticate, post.edit);

router.route('/post/:post/upvote').post(user.authenticate, post.upvote);

router.route('/post/:post/downvote').post(user.authenticate, post.downvote);

router.route('/post/:post/freeze').post(user.authenticate, post.freeze);

router.route('/post/:post/hide').post(user.authenticate, post.hide);

// replies

router.route('/post/:post/replies').get(user.deserialize, reply.getForPost);

router.route('/reply/:reply/replies').get(user.deserialize, reply.getForReply);

export { router };
