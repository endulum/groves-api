import dotenv from 'dotenv';
import express from 'express';

import authRouter from '../routes/authRouter';
import mainRouter from '../routes/mainRouter';
import errorHandler from '../middleware/errorHandler';

dotenv.config({ path: '.env' });
dotenv.config({ path: `.env.${process.env.ENV}` });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(authRouter);
app.use(mainRouter);
app.use(errorHandler);

export default app;
