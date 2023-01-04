import { Injectable } from '@angular/core';
import { CanActivate, CanLoad } from '@angular/router';
import { from, Observable, of } from 'rxjs';
import { switchMap, take } from 'rxjs/operators';
import { AuthQuery } from '../akita-fire-auth';
import { AuthenticationService } from '../authentication.service';

@Injectable({
  providedIn: 'root',
})
export class IsAuthenticatedGuard implements CanActivate, CanLoad {
  constructor(private authQuery: AuthQuery, private authService: AuthenticationService) {}

  canActivate(): Observable<boolean> | Promise<boolean> | boolean {
    return this.loginIfNotAuthenticated();
  }

  canLoad(): Observable<boolean> | Promise<boolean> | boolean {
    return this.loginIfNotAuthenticated();
  }

  private loginIfNotAuthenticated() {
    return this.authQuery.authenticated$.pipe(
      take(1),
      switchMap((isAuthenticated) =>
        isAuthenticated
          ? of(isAuthenticated)
          : from(
              this.authService.signIn().then(
                () => true,
                () => false
              )
            )
      )
    );
  }
}
