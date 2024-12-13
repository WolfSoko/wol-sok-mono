import { inject } from '@angular/core';
import { AuthFacade } from '../fire-auth/auth.facade';
import { AuthenticationService } from '../authentication.service';

export async function loginIfNotAuthenticated(): Promise<boolean> {
  const authFacade = inject(AuthFacade);
  const authenticationService = inject(AuthenticationService);
  if (authFacade.authenticated()) {
    return true;
  }
  try {
    return (await authenticationService.signIn())?.uid != null;
  } catch (e: unknown) {
    console.warn('error login if not authenticated', e);
    return false;
  }
}
