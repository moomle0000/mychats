import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import { TodoController } from './todo.controller';
import { AuthMiddleware } from '@middlewares/auth.middleware';

export class TodoRoute implements Routes {
  public path = '/api/todos';
  public router = Router();
  public todoController = new TodoController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Authenticated Users Only: All tasks are shared across all authorized users and synced across devices
    this.router.get(`${this.path}`, AuthMiddleware, this.todoController.getTodos);
    this.router.post(`${this.path}`, AuthMiddleware, this.todoController.createTodo);
    this.router.post(`${this.path}/ai-parse`, AuthMiddleware, this.todoController.aiParseTasks);
    this.router.put(`${this.path}/:id`, AuthMiddleware, this.todoController.updateTodo);
    this.router.delete(`${this.path}/completed/clear`, AuthMiddleware, this.todoController.clearCompleted);
    this.router.delete(`${this.path}/:id`, AuthMiddleware, this.todoController.deleteTodo);
  }
}
