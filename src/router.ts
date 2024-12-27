import express from 'express';
import * as auth from './controllers/auth';
import * as user from './controllers/user';
import * as community from './controllers/community';
import * as post from './controllers/post';
import * as reply from './controllers/reply';

const router = express.Router();

// account

router.route('/login').post(user.deserialize, auth.login);

router.route('/signup').post(user.deserialize, auth.signup);

router.route('/me').get(user.me).put(user.edit);

router.route('/user/:user').get(user.get);

// communities

router
  .route('/communities')
  .get(community.search)
  .post(user.authenticate, community.create);

router
  .route('/community/:community')
  .get(user.deserialize, community.get)
  .put(user.authenticate, community.edit);

router
  .route('/community/:community/moderators')
  .put(user.authenticate, community.editModerators);

router
  .route('/community/:community/wiki')
  .get(community.getWiki)
  .put(user.authenticate, community.editWiki);

router
  .route('/community/:community/followers')
  .put(user.authenticate, community.follow);

router
  .route('/community/:community/status')
  .put(user.authenticate, community.editStatus);

router
  .route('/community/:community/actions')
  .get(user.deserialize, community.getActions);

// posts

router
  .route('/community/:community/posts')
  .get(post.search)
  .post(user.authenticate, post.create);

router
  .route('/post/:post')
  .get(user.deserialize, post.get)
  .put(user.authenticate, post.edit);

router.route('/post/:post/vote').put(user.authenticate, post.vote);

router.route('/post/:post/status').put(user.authenticate, post.editStatus);

// replies

router
  .route('/post/:post/replies')
  .get(user.deserialize, reply.getForPost)
  .post(user.authenticate, reply.create);

router.route('/reply/:reply').get(user.deserialize, reply.get);

router.route('/reply/:reply/replies').get(user.deserialize, reply.getForReply);

router.route('/reply/:reply/vote').put(user.authenticate, reply.vote);

router.route('/reply/:reply/status').put(user.authenticate, reply.editStatus);

export { router };
