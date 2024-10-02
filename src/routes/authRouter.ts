import express from 'express';
import handleValidationErrors from '../middleware/handleValidationErrors';

import login from '../controllers/login';
import signup from '../controllers/signup';

const router = express.Router();

router.route('/login')
  .post(login.validate, handleValidationErrors, login.submit);

router.route('/signup')
  .post(signup.validate, handleValidationErrors, signup.submit);

export default router;
