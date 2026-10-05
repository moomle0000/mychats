import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import { ToolController } from './tool.controller';
import { AuthMiddleware, OptionalAuthMiddleware } from '@middlewares/auth.middleware';

export class ToolRoute implements Routes {
  public path = '/api/tools';
  public router = Router();
  public toolController = new ToolController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    this.router.get(`${this.path}`, OptionalAuthMiddleware, this.toolController.getTools);
    this.router.get(`${this.path}/:id`, OptionalAuthMiddleware, this.toolController.getTool);
    this.router.post(`${this.path}`, AuthMiddleware, this.toolController.createTool);
    this.router.put(`${this.path}/:id`, AuthMiddleware, this.toolController.updateTool);
    this.router.delete(`${this.path}/:id`, AuthMiddleware, this.toolController.deleteTool);
  }
}
