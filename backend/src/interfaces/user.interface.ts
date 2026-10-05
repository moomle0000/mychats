import { Document, Types } from 'mongoose';

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  username: string;
  password?: string;
  passwordHash?: string;
  fullName?: string;
  oauthProvider?: 'google' | 'github' | 'local' | null;
  oauthId?: string | null;
  avatarUrl?: string;
  role: 'admin' | 'user';
  deviceLabel?: string;
  tenantId?: string | null;
  isActive: boolean;
  isVerified?: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type UserRole = 'admin' | 'user';