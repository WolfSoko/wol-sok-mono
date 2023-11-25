import { CanActivateFn, CanMatchFn } from '@angular/router';
import { loginIfNotAuthenticated } from './login-if-not-authenticated';

export const canActivateWithLoginIfNotAuthenticated: CanActivateFn =
  loginIfNotAuthenticated;
export const canMatchWithLoginIfNotAuthenticated: CanMatchFn =
  loginIfNotAuthenticated;
