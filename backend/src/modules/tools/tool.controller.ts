import { NextFunction, Request, Response } from 'express';
import { Container } from 'typedi';
import { ToolService } from './tool.service';
import { RequestWithUser } from '@interfaces/auth.interface';

export class ToolController {
  public toolService = Container.get(ToolService);

  public getTools = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.toolService.getAllTools();
      res.status(200).json({ data, message: 'Tools retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };

  public getTool = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id;
      const data = await this.toolService.getToolById(id);
      res.status(200).json({ data, message: 'Tool retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };

  public createTool = async (req: RequestWithUser, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { name, description, systemPrompt, icon } = req.body;
      const userId = req.user ? req.user._id : null;

      const data = await this.toolService.createTool({
        name,
        description,
        systemPrompt,
        icon,
        createdBy: userId,
      });

      res.status(201).json({ data, message: 'Tool created successfully' });
    } catch (error) {
      next(error);
    }
  };

  public updateTool = async (req: RequestWithUser, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id;
      const { name, description, systemPrompt, icon } = req.body;

      const data = await this.toolService.updateTool(id, {
        name,
        description,
        systemPrompt,
        icon,
      });

      res.status(200).json({ data, message: 'Tool updated successfully' });
    } catch (error) {
      next(error);
    }
  };

  public deleteTool = async (req: RequestWithUser, res: Response, next: NextFunction): Promise<void> => {
    try {
      const id = req.params.id;
      const data = await this.toolService.deleteTool(id);
      res.status(200).json({ data, message: 'Tool deleted successfully' });
    } catch (error) {
      next(error);
    }
  };
}
