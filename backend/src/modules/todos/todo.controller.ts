import { Request, Response, NextFunction } from 'express';
import { Container } from 'typedi';
import { TodoService } from './todo.service';

export class TodoController {
  private todoService = Container.get(TodoService);

  public getTodos = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const deviceId = req.headers['x-device-id'] ? decodeURIComponent(String(req.headers['x-device-id'])) : undefined;
      const userId = (req as any).user?._id;
      const { status, priority, search } = req.query;

      const todos = await this.todoService.getTodos({
        deviceId,
        userId: userId ? String(userId) : undefined,
        status: status ? String(status) : undefined,
        priority: priority ? String(priority) : undefined,
        search: search ? String(search) : undefined,
      });

      res.status(200).json({ data: todos, message: 'Todos retrieved successfully' });
    } catch (error) {
      next(error);
    }
  };

  public createTodo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const deviceId = req.headers['x-device-id'] ? decodeURIComponent(String(req.headers['x-device-id'])) : undefined;
      const userId = (req as any).user?._id;

      const todo = await this.todoService.createTodo({
        ...req.body,
        deviceId: req.body.deviceId || deviceId,
        userId: userId ? String(userId) : req.body.userId,
      });

      res.status(201).json({ data: todo, message: 'Todo created successfully' });
    } catch (error) {
      next(error);
    }
  };

  public updateTodo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const updated = await this.todoService.updateTodo(id, req.body);
      res.status(200).json({ data: updated, message: 'Todo updated successfully' });
    } catch (error) {
      next(error);
    }
  };

  public deleteTodo = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      await this.todoService.deleteTodo(id);
      res.status(200).json({ message: 'Todo deleted successfully' });
    } catch (error) {
      next(error);
    }
  };

  public clearCompleted = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const deviceId = req.headers['x-device-id'] ? decodeURIComponent(String(req.headers['x-device-id'])) : undefined;
      const userId = (req as any).user?._id;

      const count = await this.todoService.clearCompleted({
        deviceId,
        userId: userId ? String(userId) : undefined,
      });

      res.status(200).json({ count, message: `Cleared ${count} completed todos` });
    } catch (error) {
      next(error);
    }
  };

  public aiParseTasks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { text } = req.body;
      const tasks = await this.todoService.parseNaturalLanguageToTasks(text);
      res.status(200).json({ data: tasks, message: 'Tasks parsed with AI successfully' });
    } catch (error) {
      next(error);
    }
  };
}
