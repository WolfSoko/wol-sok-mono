import { inject } from '@angular/core';

import { from, Observable, of } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import { AuthQuery } from '../akita-fire-auth';
import { AuthenticationService } from '../authentication.service';

export function loginIfNotAuthenticated(): Observable<boolean> {
  const authQuery = inject(AuthQuery);
  const authenticationService = inject(AuthenticationService);
  return authQuery.authenticated$.pipe(
    take(1),
    switchMap((isAuthenticated) =>
      isAuthenticated
        ? of(isAuthenticated)
        : from(
            authenticationService.signIn().then(
              () => true,
              () => false
            )
          )
    )
  );
}
