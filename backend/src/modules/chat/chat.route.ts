import { Router } from 'express';
import { Routes } from '@interfaces/routes.interface';
import { ChatController } from './chat.controller';
import { AuthMiddleware, OptionalAuthMiddleware } from '@middlewares/auth.middleware';
import { upload } from '@middlewares/fileUpload.middleware';

export class ChatRoute implements Routes {
  public path = '/api';
  public router = Router();
  public chatController = new ChatController();

  constructor() {
    this.initializeRoutes();
  }

  private initializeRoutes() {
    // Chat endpoints
    this.router.get(`${this.path}/chat/stream`, this.chatController.stream);
    this.router.get(`${this.path}/chat/conversations`, AuthMiddleware, this.chatController.listArchives);
    this.router.get(`${this.path}/chat/conversations/:id`, AuthMiddleware, this.chatController.getConversation);
    this.router.get(`${this.path}/chat/messages`, OptionalAuthMiddleware, this.chatController.getMessages);
    this.router.post(`${this.path}/chat/messages`, OptionalAuthMiddleware, this.chatController.createMessage);
    this.router.post(`${this.path}/chat/ai`, OptionalAuthMiddleware, this.chatController.sendAIMessage);
    this.router.delete(`${this.path}/chat/messages/:id`, OptionalAuthMiddleware, this.chatController.deleteMessage);
    this.router.post(`${this.path}/chat/upload`, upload.single('file'), this.chatController.uploadFile);
    this.router.post(`${this.path}/chat/clear`, OptionalAuthMiddleware, this.chatController.clear);

    this.router.patch(`${this.path}/chat/conversations/:id/pin`, AuthMiddleware, this.chatController.togglePinConversation);

    // Admin endpoints (protected by AuthMiddleware)
    this.router.get(`${this.path}/admin/conversations`, AuthMiddleware, this.chatController.listArchives);
    this.router.get(`${this.path}/admin/conversations/:id`, AuthMiddleware, this.chatController.getConversation);
    this.router.patch(`${this.path}/admin/conversations/:id`, AuthMiddleware, this.chatController.renameConversation);
    this.router.patch(`${this.path}/admin/conversations/:id/pin`, AuthMiddleware, this.chatController.togglePinConversation);
    this.router.delete(`${this.path}/admin/conversations/:id`, AuthMiddleware, this.chatController.deleteConversation);
    this.router.get(`${this.path}/admin/conversations/:id/export`, AuthMiddleware, this.chatController.exportConversation);
    this.router.get(`${this.path}/admin/stats`, AuthMiddleware, this.chatController.getStats);
  }
}
