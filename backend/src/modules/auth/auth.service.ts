import { hash, compare } from 'bcrypt';
import { sign } from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';
import { Service } from 'typedi';
import { SECRET_KEY, JWT_EXPIRES_IN, BCRYPT_ROUNDS, GOOGLE_CLIENT_ID, JWT_COOKIE_SECURE } from '@config';
import { HttpException } from '@exceptions/httpException';
import { DataStoredInToken, TokenData } from '@interfaces/auth.interface';
import { IUser } from '@interfaces/user.interface';
import { LoginDto, RegisterDto } from '@dtos/auth.dto';
import { UserModel } from './user.model';

@Service()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor() {
    this.googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
  }

  public async register(userData: RegisterDto): Promise<{ user: Partial<IUser>; tokenData: TokenData; cookie: string }> {
    const userCount = await UserModel.countDocuments();
    if (userCount > 0) {
      throw new HttpException(403, 'Account creation is disabled. This is a personal private application.');
    }

    const hashedPassword = await hash(userData.password, BCRYPT_ROUNDS);
    const role = 'admin';

    const createUserData = await UserModel.create({
      email: userData.email.toLowerCase().trim(),
      username: userData.username.trim(),
      passwordHash: hashedPassword,
      role,
      oauthProvider: 'local',
      tenantId: 'personal',
      isActive: true,
      lastLoginAt: new Date(),
    });

    const tokenData = this.createToken(createUserData);
    const cookie = this.createCookie(tokenData);

    const safeUser = this.sanitizeUser(createUserData);
    return { user: safeUser, tokenData, cookie };
  }

  public async login(loginData: LoginDto): Promise<{ user: Partial<IUser>; tokenData: TokenData; cookie: string }> {
    const findUser = await UserModel.findOne({ email: loginData.email.toLowerCase().trim() });
    if (!findUser) {
      throw new HttpException(401, 'Invalid email or password');
    }

    if (!findUser.passwordHash) {
      throw new HttpException(400, 'This account was created via Google OAuth. Please log in with Google.');
    }

    const isPasswordMatching = await compare(loginData.password, findUser.passwordHash);
    if (!isPasswordMatching) {
      throw new HttpException(401, 'Invalid email or password');
    }

    findUser.lastLoginAt = new Date();
    await findUser.save();

    const tokenData = this.createToken(findUser);
    const cookie = this.createCookie(tokenData);

    const safeUser = this.sanitizeUser(findUser);
    return { user: safeUser, tokenData, cookie };
  }

  public async loginWithGoogle(idToken: string): Promise<{ user: Partial<IUser>; tokenData: TokenData; cookie: string }> {
    let email = '';
    let name = '';
    let picture = '';
    let googleId = '';

    try {
      if (GOOGLE_CLIENT_ID) {
        const ticket = await this.googleClient.verifyIdToken({
          idToken,
          audience: GOOGLE_CLIENT_ID,
        });
        const payload = ticket.getPayload();
        if (!payload || !payload.email) {
          throw new HttpException(400, 'Invalid Google ID token');
        }
        email = payload.email.toLowerCase().trim();
        name = payload.name || payload.email.split('@')[0];
        picture = payload.picture || '';
        googleId = payload.sub;
      } else {
        // Fallback decoder if client ID is not yet configured in local test
        const parts = idToken.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
          email = (payload.email || '').toLowerCase().trim();
          name = payload.name || email.split('@')[0];
          picture = payload.picture || '';
          googleId = payload.sub || '';
        }
      }
    } catch (error: any) {
      throw new HttpException(401, `Google verification failed: ${error?.message || 'Invalid token'}`);
    }

    if (!email) {
      throw new HttpException(400, 'Email not provided by Google');
    }

    let user = await UserModel.findOne({
      $or: [{ email }, { oauthId: googleId }],
    });

    if (!user) {
      const userCount = await UserModel.countDocuments();
      if (userCount > 0) {
        throw new HttpException(403, 'Account creation is disabled. This is a personal private application.');
      }
      user = await UserModel.create({
        email,
        username: name || email.split('@')[0],
        oauthProvider: 'google',
        oauthId: googleId,
        avatarUrl: picture,
        role: 'admin',
        tenantId: 'personal',
        isActive: true,
        lastLoginAt: new Date(),
      });
    } else {
      user.oauthProvider = 'google';
      user.oauthId = googleId;
      if (picture && !user.avatarUrl) user.avatarUrl = picture;
      user.lastLoginAt = new Date();
      await user.save();
    }

    const tokenData = this.createToken(user);
    const cookie = this.createCookie(tokenData);

    const safeUser = this.sanitizeUser(user);
    return { user: safeUser, tokenData, cookie };
  }

  public createToken(user: IUser): TokenData {
    const dataStoredInToken: DataStoredInToken = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      tenantId: user.tenantId ? String(user.tenantId) : 'personal',
    };
    const expiresInNumber = 30 * 24 * 60 * 60; // 30 days in seconds
    const token = sign(dataStoredInToken, SECRET_KEY, { expiresIn: JWT_EXPIRES_IN });

    return { expiresIn: expiresInNumber, token };
  }

  public createCookie(tokenData: TokenData): string {
    const secureFlag = JWT_COOKIE_SECURE ? '; Secure' : '';
    return `Authorization=${tokenData.token}; HttpOnly; Max-Age=${tokenData.expiresIn}; Path=/; SameSite=Lax${secureFlag}`;
  }

  public sanitizeUser(user: IUser): Partial<IUser> {
    const obj: any = user.toObject ? user.toObject() : { ...user };
    delete obj.passwordHash;
    delete obj.password;
    return obj as Partial<IUser>;
  }

  // --- Admin Account Management Methods ---

  public async listUsers(): Promise<Partial<IUser>[]> {
    const users = await UserModel.find().sort({ createdAt: 1 });
    return users.map((u) => this.sanitizeUser(u));
  }

  public async createUserByAdmin(userData: {
    email: string;
    username: string;
    password?: string;
    deviceLabel?: string;
    role?: 'admin' | 'user';
  }): Promise<Partial<IUser>> {
    const email = userData.email.toLowerCase().trim();
    const existing = await UserModel.findOne({ email });
    if (existing) {
      throw new HttpException(409, `An account with email ${email} already exists`);
    }

    if (!userData.password || userData.password.length < 6) {
      throw new HttpException(400, 'Password must be at least 6 characters');
    }

    const hashedPassword = await hash(userData.password, BCRYPT_ROUNDS);

    const newUser = await UserModel.create({
      email,
      username: userData.username.trim(),
      passwordHash: hashedPassword,
      deviceLabel: (userData.deviceLabel || '').trim(),
      role: userData.role || 'admin',
      oauthProvider: 'local',
      tenantId: 'personal',
      isActive: true,
      lastLoginAt: null,
    });

    return this.sanitizeUser(newUser);
  }

  public async updateUserByAdmin(
    id: string,
    updateData: {
      username?: string;
      deviceLabel?: string;
      password?: string;
      role?: 'admin' | 'user';
      isActive?: boolean;
    }
  ): Promise<Partial<IUser>> {
    const user = await UserModel.findById(id);
    if (!user) {
      throw new HttpException(404, 'User not found');
    }

    if (updateData.username !== undefined) {
      user.username = updateData.username.trim();
    }
    if (updateData.deviceLabel !== undefined) {
      user.deviceLabel = updateData.deviceLabel.trim();
    }
    if (updateData.role !== undefined) {
      user.role = updateData.role;
    }
    if (updateData.isActive !== undefined) {
      user.isActive = updateData.isActive;
    }
    if (updateData.password && updateData.password.trim()) {
      if (updateData.password.length < 6) {
        throw new HttpException(400, 'Password must be at least 6 characters');
      }
      user.passwordHash = await hash(updateData.password, BCRYPT_ROUNDS);
    }

    await user.save();
    return this.sanitizeUser(user);
  }

  public async deleteUserByAdmin(id: string, currentAdminId?: string): Promise<{ deleted: boolean; id: string }> {
    if (currentAdminId && id === currentAdminId) {
      throw new HttpException(400, 'Cannot delete your own active account');
    }

    const user = await UserModel.findById(id);
    if (!user) {
      throw new HttpException(404, 'User not found');
    }

    const totalUsers = await UserModel.countDocuments();
    if (totalUsers <= 1) {
      throw new HttpException(400, 'Cannot delete the only remaining account');
    }

    await UserModel.findByIdAndDelete(id);
    return { deleted: true, id };
  }
}
