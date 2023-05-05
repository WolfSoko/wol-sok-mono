import { InjectionToken } from '@angular/core';
import { APP_ROUTES, MainNavRoute, MainNavRoutes } from './app-routing';

export const ROUTER_LINKS = new InjectionToken<MainNavRoutes>('routerLinks', {
  providedIn: 'root',
  factory: () => APP_ROUTES,
});
