import { Request } from 'express';
import { IUser } from './user.interface';

export interface DataStoredInToken {
  id: string;
  role?: string;
  tenantId?: string;
  email?: string;
}

export interface TokenData {
  token: string;
  expiresIn: number | string;
}

export interface RequestWithUser extends Request {
  user?: IUser;
  tenant?: any;
}
