import { InjectionToken } from '@angular/core';
import { APP_ROUTES, MainNavRoute } from './app-routing.module';

export const ROUTER_LINKS = new InjectionToken<MainNavRoute[]>('routerLinks', {
  providedIn: 'root',
  factory: () => APP_ROUTES,
});
