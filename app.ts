import dotenv from 'dotenv';
import express from 'express';
import asyncHandler from 'express-async-handler';
import cors from 'cors';
import logger from 'morgan';

import { errorHandler } from './src/middleware/errorHandler';
import { router as authRouter } from './src/routers/authRouter';
import { router as indexRouter } from './src/routers/indexRouter';

dotenv.config({ path: '.env' });
dotenv.config({ path: `.env.${process.env.ENV}` });

const app = express();

app.use(cors({
  origin: '*',
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// suppress favicon request
app.get('/favicon.ico', (req, res) => res.status(204).end());

// log method and given values
if (process.env.ENV === 'development') {
  app.use(logger('dev'));
  app.use(asyncHandler(async (req, _res, next) => {
    if (['POST', 'PUT'].includes(req.method)) console.dir(req.body, { depth: null });
    if (req.method === 'GET' && Object.keys(req.params).length > 1) console.dir(req.params, { depth: null });
    next();
  }));
}

app.use(authRouter);
app.use(indexRouter);

app.use('*', asyncHandler(async (_req, res) => {
  res.sendStatus(404);
}));

app.use(errorHandler);

app.listen(3000);
