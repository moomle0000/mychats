import { NextFunction, Response } from 'express';
import { Container } from 'typedi';
import { SettingService } from './setting.service';
import { RequestWithUser } from '@interfaces/auth.interface';

export class SettingController {
  public settingService = Container.get(SettingService);

  public getAISettings = async (req: RequestWithUser, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.settingService.getAISettings();
      res.status(200).json({ data, message: 'AI settings retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };

  public updateAISettings = async (req: RequestWithUser, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { aiBaseUrl, defaultModel, apiKey } = req.body;
      const data = await this.settingService.updateAISettings({ aiBaseUrl, defaultModel, apiKey });
      res.status(200).json({ data, message: 'AI settings updated successfully' });
    } catch (error) {
      next(error);
    }
  };

  public fetchModels = async (req: RequestWithUser, res: Response, next: NextFunction): Promise<void> => {
    try {
      const url = req.query.url as string | undefined;
      const apiKey = req.query.apiKey as string | undefined;
      const data = await this.settingService.fetchAvailableModels(url, apiKey);
      res.status(200).json({ data, message: 'Models retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };
}
