import { type Request, type Response, type NextFunction } from 'express';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction,
) => {
  console.error(err);
  const status =
    'status' in err && typeof err.status === 'number' ? err.status : 500;
  res
    .status(status)
    .send('Sorry, something went wrong when handling your request.');
};
