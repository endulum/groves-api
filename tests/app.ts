import dotenv from 'dotenv';
import express from 'express';

import { errorHandler } from '../src/middleware/errorHandler';
import { router as authRouter } from '../src/routers/authRouter';
import { router as indexRouter } from '../src/routers/indexRouter';

dotenv.config({ path: '.env' });
dotenv.config({ path: `.env.${process.env.ENV}` });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authRouter);
app.use(indexRouter);
app.use(errorHandler);

export default app;
