import { Routes } from '@interfaces/routes.interface';
import { AuthRoute } from './auth';
import { ChatRoute } from './chat';
import { ToolRoute } from './tools';

export * from './tenant';
export * from './auth';
export * from './chat';
export * from './tools';

export const appRoutes: Routes[] = [
  new AuthRoute(),
  new ChatRoute(),
  new ToolRoute(),
];
