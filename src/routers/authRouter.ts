import express from 'express';

import * as auth from '../controllers/auth';

const router = express.Router();

router.route('/login')
  .post(auth.login);

router.route('/signup')
  .post(auth.signup);

export { router };
