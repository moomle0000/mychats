import { Routes } from '@interfaces/routes.interface';
import { AuthRoute } from './auth';
import { ChatRoute } from './chat';
import { ToolRoute } from './tools';
import { TodoRoute } from './todos';
import { SettingRoute } from './settings';

export * from './tenant';
export * from './auth';
export * from './chat';
export * from './tools';
export * from './todos';
export * from './settings';

export const appRoutes: Routes[] = [
  new AuthRoute(),
  new ChatRoute(),
  new ToolRoute(),
  new TodoRoute(),
  new SettingRoute(),
];
