import { NextFunction, Request, Response } from 'express';
import { Container } from 'typedi';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto, GoogleAuthDto } from '@dtos/auth.dto';
import { RequestWithUser } from '@interfaces/auth.interface';

export class AuthController {
  public authService = Container.get(AuthService);

  public register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userData: RegisterDto = req.body;
      const { user, tokenData, cookie } = await this.authService.register(userData);

      res.setHeader('Set-Cookie', [cookie]);
      res.status(201).json({ data: user, token: tokenData.token, message: 'Registered successfully' });
    } catch (error) {
      next(error);
    }
  };

  public login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const loginData: LoginDto = req.body;
      const { user, tokenData, cookie } = await this.authService.login(loginData);

      res.setHeader('Set-Cookie', [cookie]);
      res.status(200).json({ data: user, token: tokenData.token, message: 'Login successful' });
    } catch (error) {
      next(error);
    }
  };

  public googleAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { idToken }: GoogleAuthDto = req.body;
      const { user, tokenData, cookie } = await this.authService.loginWithGoogle(idToken);

      res.setHeader('Set-Cookie', [cookie]);
      res.status(200).json({ data: user, token: tokenData.token, message: 'Google authentication successful' });
    } catch (error) {
      next(error);
    }
  };

  public me = async (req: RequestWithUser, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user || null;
      res.status(200).json({ data: user, message: user ? 'Authenticated user' : 'Unauthenticated' });
    } catch (error) {
      next(error);
    }
  };

  public logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.setHeader('Set-Cookie', ['Authorization=; HttpOnly; Max-Age=0; Path=/; SameSite=Lax']);
      res.status(200).json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  };

  // --- Admin Account Management Endpoints ---

  public getAdminUsers = async (req: RequestWithUser, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.authService.listUsers();
      res.status(200).json({ data, message: 'Users retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };

  public createAdminUser = async (req: RequestWithUser, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, username, password, deviceLabel, role } = req.body;
      const data = await this.authService.createUserByAdmin({
        email,
        username,
        password,
        deviceLabel,
        role,
      });
      res.status(201).json({ data, message: 'Account created successfully' });
    } catch (error) {
      next(error);
    }
  };

  public updateAdminUser = async (req: RequestWithUser, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id;
      const { username, deviceLabel, password, role, isActive } = req.body;
      const data = await this.authService.updateUserByAdmin(id, {
        username,
        deviceLabel,
        password,
        role,
        isActive,
      });
      res.status(200).json({ data, message: 'Account updated successfully' });
    } catch (error) {
      next(error);
    }
  };

  public deleteAdminUser = async (req: RequestWithUser, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id;
      const currentAdminId = req.user ? req.user._id.toString() : undefined;
      const data = await this.authService.deleteUserByAdmin(id, currentAdminId);
      res.status(200).json({ data, message: 'Account deleted successfully' });
    } catch (error) {
      next(error);
    }
  };
}
