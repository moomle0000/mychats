import { NextFunction, Request, Response } from 'express';
import { logger } from '@utils/logger';

export const ErrorMiddleware = (error: any, req: Request, res: Response, next: NextFunction) => {
  try {
    const status: number = error.status || 500;
    const message: string = error.message || 'Something went wrong';

    // 404 is often expected (e.g. missing timetable config, lookup misses) - log as warn to reduce noise
    if (status === 404) {
      logger.warn(`[${req.method}] ${req.path} >> StatusCode:: ${status}, Message:: ${message}`);
    } else {
      logger.error(`[${req.method}] ${req.path} >> StatusCode:: ${status}, Message:: ${message}`);
    }
    res.status(status).json({ message });
  } catch (error) {
    next(error);
  }
};
