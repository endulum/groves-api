import express from 'express';
import * as auth from './controllers/auth';
import * as user from './controllers/user';
import * as community from './controllers/community';
import * as post from './controllers/post';
import * as reply from './controllers/reply';
import * as feed from './controllers/feed';

const router = express.Router();

// feed

router.route('/all').get(feed.get);
router.route('/feed').get(user.authenticate, feed.get);

// account

router.route('/login').post(user.deserialize, auth.login);

router.route('/signup').post(user.deserialize, auth.signup);

// user

router.route('/me').get(user.me).put(user.edit);

router.route('/user/:user').get(user.get);

router.route('/user/:user/actions').get(user.getActions);

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
  .route('/community/:community/admin')
  .put(user.authenticate, community.changeAdmin);

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

router
  .route('/community/:community/pinned')
  .get(user.deserialize, post.getPinned);

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

router.route('/post/:post/pin').put(user.authenticate, post.pin);

// router.route('/post/:post/pinned').get(user.deserialize, reply.getPinned);

// replies

router
  .route('/post/:post/replies')
  .get(user.deserialize, reply.getForPost)
  .post(user.authenticate, reply.create);

router.route('/reply/:reply').get(user.deserialize, reply.get);

router.route('/reply/:reply/replies').get(user.deserialize, reply.getForReply);

router.route('/reply/:reply/vote').put(user.authenticate, reply.vote);

router.route('/reply/:reply/status').put(user.authenticate, reply.editStatus);

router.route('/reply/:reply/pin').put(user.authenticate, reply.pin);

export { router };
