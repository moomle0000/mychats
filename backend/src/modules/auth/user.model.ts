import { model, Schema } from 'mongoose';
import { IUser } from '@interfaces/user.interface';

const userSchema: Schema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: false,
    },
    oauthProvider: {
      type: String,
      enum: ['google', 'github', 'local', null],
      default: 'local',
    },
    oauthId: {
      type: String,
      sparse: true,
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['admin', 'user'],
      default: 'admin',
    },
    deviceLabel: {
      type: String,
      default: '',
      trim: true,
    },
    tenantId: {
      type: String,
      default: 'personal',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const UserModel = model<IUser>('User', userSchema);
