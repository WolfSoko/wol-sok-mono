import { InjectionToken } from '@angular/core';
import { MainNavRoute } from './app-routing.module';

export const ROUTER_LINKS = new InjectionToken<MainNavRoute[]>('routerLinks');
