import dotenv from 'dotenv';
import express from 'express';
import asyncHandler from 'express-async-handler';
import cors from 'cors';
import logger from 'morgan';

import { errorHandler } from './src/middleware/errorHandler';
import { router } from './src/router';

dotenv.config({ path: '.env' });
dotenv.config({ path: `.env.${process.env.NODE_ENV}` });
console.warn(`environment: ${process.env.NODE_ENV}`);

const app = express();

app.use(cors({ origin: process.env.FRONTEND_URL }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// suppress favicon request
app.get('/favicon.ico', (_req, res) => res.status(204).end());

// in dev, log method and given values
if (process.env.NODE_ENV === 'development') {
  app.use(logger('dev'));
  app.use(
    asyncHandler(async (req, _res, next) => {
      if (['POST', 'PUT'].includes(req.method))
        // eslint-disable-next-line no-console
        console.dir(req.body, { depth: null });
      if (req.method === 'GET' && Object.keys(req.params).length > 1)
        // eslint-disable-next-line no-console
        console.dir(req.params, { depth: null });
      next();
    }),
  );
}

app.use(router);

app.use(
  '*',
  asyncHandler(async (_req, res) => {
    res.sendStatus(404);
  }),
);

app.use(errorHandler);

const port = process.env.PORT ?? 3000;
app.listen(port, () => {
  console.warn(`⚡️ server starting at http://localhost:${port}`);
});
