import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import { SettingController } from './setting.controller';
import { AuthMiddleware, roleCheck } from '@middlewares/auth.middleware';

export class SettingRoute implements Routes {
  public path = '/api/settings';
  public router = Router();
  public settingController = new SettingController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Only administrators can view, update, or test AI settings
    this.router.get(`${this.path}/ai`, AuthMiddleware, roleCheck('admin'), this.settingController.getAISettings);
    this.router.put(`${this.path}/ai`, AuthMiddleware, roleCheck('admin'), this.settingController.updateAISettings);
    this.router.get(`${this.path}/ai/models`, AuthMiddleware, roleCheck('admin'), this.settingController.fetchModels);
  }
}
