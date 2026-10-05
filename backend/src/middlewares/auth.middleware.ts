import { NextFunction, Request, Response, RequestHandler } from 'express';
import { verify } from 'jsonwebtoken';
import { SECRET_KEY } from '@config';
import { DataStoredInToken, RequestWithUser } from '@interfaces/auth.interface';
import { IUser } from '@interfaces/user.interface';
import { UserModel } from '../modules/auth/user.model';

export const getAuthorization = (req: Request): string | null => {
  // 1) Header
  const header = req.header('Authorization');
  if (header) {
    const token = header.startsWith('Bearer ') ? header.split('Bearer ')[1] : header;
    if (token) return token.trim();
  }

  // 2) Cookies
  if (req.cookies) {
    if (req.cookies['Authorization']) return req.cookies['Authorization'];
    if (req.cookies['token']) return req.cookies['token'];
  }

  return null;
};

export const AuthMiddleware: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorization = getAuthorization(req);

    if (!authorization) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const tokenData = verify(authorization, SECRET_KEY) as DataStoredInToken;
    const { id } = tokenData;

    const findUser = await UserModel.findById(id).select('-passwordHash').lean().exec();

    if (!findUser) {
      return res.status(401).json({ message: 'User not found or deleted' });
    }

    (req as RequestWithUser).user = findUser as unknown as IUser;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

export const OptionalAuthMiddleware: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authorization = getAuthorization(req);
    if (authorization) {
      const tokenData = verify(authorization, SECRET_KEY) as DataStoredInToken;
      const { id } = tokenData;
      const findUser = await UserModel.findById(id).select('-passwordHash').lean().exec();
      if (findUser) {
        (req as RequestWithUser).user = findUser as unknown as IUser;
      }
    }
  } catch (err) {
    // silently continue as unauthenticated
  }
  next();
};

export const roleCheck = (requiredRole: string): RequestHandler => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = (req as RequestWithUser).user;
      if (!user) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      if (user.role === 'admin' || user.role === requiredRole) {
        return next();
      }

      return res.status(403).json({ message: 'Forbidden: Insufficient permissions' });
    } catch (error) {
      return res.status(403).json({ message: 'Forbidden' });
    }
  };
};