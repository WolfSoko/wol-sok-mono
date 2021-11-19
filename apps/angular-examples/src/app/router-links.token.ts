import { MainNavRoute } from './app-routing.module';
import { InjectionToken } from '@angular/core';

export const ROUTER_LINKS = new InjectionToken<MainNavRoute[]>('routerLinks');
