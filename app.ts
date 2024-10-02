import dotenv from 'dotenv';
import express from 'express';
import asyncHandler from 'express-async-handler';

import errorHandler from './src/middleware/errorHandler';
import authRouter from './src/routes/authRouter';
import mainRouter from './src/routes/mainRouter';

dotenv.config({ path: '.env' });
dotenv.config({ path: `.env.${process.env.ENV}` });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(authRouter);
app.use(mainRouter);

app.use('*', asyncHandler(async (_req, res) => {
  res.sendStatus(404);
}));

app.use(errorHandler);

app.listen(3000);
