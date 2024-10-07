import dotenv from 'dotenv';
import express from 'express';
import asyncHandler from 'express-async-handler';
import cors from 'cors';
import logger from 'morgan';

import errorHandler from './src/middleware/errorHandler';
import authRouter from './src/routes/authRouter';
import mainRouter from './src/routes/mainRouter';

dotenv.config({ path: '.env' });
dotenv.config({ path: `.env.${process.env.ENV}` });

const app = express();

app.use(cors({
  origin: '*',
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.ENV === 'development') {
  app.use(logger('dev'));
  app.use(asyncHandler(async (req, _res, next) => {
    console.dir(req.body, { depth: null });
    next();
  }));
}

app.use(authRouter);
app.use(mainRouter);

app.use('*', asyncHandler(async (_req, res) => {
  res.sendStatus(404);
}));

app.use(errorHandler);

app.listen(3000);
