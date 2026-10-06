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
    // Both unauthenticated and authenticated users can access their tasks (filtered by deviceId / userId)
    this.router.get(`${this.path}`, this.todoController.getTodos);
    this.router.post(`${this.path}`, this.todoController.createTodo);
    this.router.post(`${this.path}/ai-parse`, this.todoController.aiParseTasks);
    this.router.put(`${this.path}/:id`, this.todoController.updateTodo);
    this.router.delete(`${this.path}/completed/clear`, this.todoController.clearCompleted);
    this.router.delete(`${this.path}/:id`, this.todoController.deleteTodo);
  }
}
