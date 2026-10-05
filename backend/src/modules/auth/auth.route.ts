import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import { AuthController } from './auth.controller';
import { AuthMiddleware } from '@middlewares/auth.middleware';

export class AuthRoute implements Routes {
  public path = '/api/auth';
  public router = Router();
  public authController = new AuthController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.post(`${this.path}/register`, this.authController.register);
    this.router.post(`${this.path}/login`, this.authController.login);
    this.router.post(`${this.path}/oauth/google`, this.authController.googleAuth);
    this.router.get(`${this.path}/me`, AuthMiddleware, this.authController.me);
    this.router.post(`${this.path}/logout`, this.authController.logout);

    // Admin Account & Device Management endpoints
    this.router.get(`/api/admin/users`, AuthMiddleware, this.authController.getAdminUsers);
    this.router.post(`/api/admin/users`, AuthMiddleware, this.authController.createAdminUser);
    this.router.put(`/api/admin/users/:id`, AuthMiddleware, this.authController.updateAdminUser);
    this.router.delete(`/api/admin/users/:id`, AuthMiddleware, this.authController.deleteAdminUser);
  }
}
