import { inject } from '@angular/core';
import type { CanMatchFn } from '@angular/router';
import { AdminAccessService } from './admin-access.service';

/**
 * Lets the admin views match only for the owner, so no admin query runs
 * before. Anybody else falls through to the gate, which offers a sign-in.
 */
export const adminGuard: CanMatchFn = async () =>
  (await inject(AdminAccessService).check()) === 'granted';
