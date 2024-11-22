import dotenv from 'dotenv';
import express from 'express';

import { errorHandler } from '../src/middleware/errorHandler';
import { router } from '../src/router';

dotenv.config({ path: '.env' });
dotenv.config({ path: `.env.${process.env.ENV}` });

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(router);
app.use(errorHandler);

export default app;
