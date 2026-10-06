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
    // Public: stateless AI text→tasks transform, no auth needed (also avoids
    // cross-origin cookie issues on direct BACKEND_URL calls from the browser).
    this.router.post(`${this.path}/ai-parse`, this.todoController.aiParseTasks);
    this.router.put(`${this.path}/:id`, AuthMiddleware, this.todoController.updateTodo);
    this.router.delete(`${this.path}/completed/clear`, AuthMiddleware, this.todoController.clearCompleted);
    this.router.delete(`${this.path}/:id`, AuthMiddleware, this.todoController.deleteTodo);
  }
}
