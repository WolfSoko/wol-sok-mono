import { Component } from '@angular/core';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import { AuthenticationService, AuthQuery, Profile } from '../core';
import { Observable } from 'rxjs';
import { startWith } from 'rxjs/operators';

@UntilDestroy()
@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
})
export class LoginComponent {
  user$: Observable<Profile | null>;

  constructor(
    private authQuery: AuthQuery,
    private authService: AuthenticationService
  ) {
    this.user$ = this.authQuery.profile$.pipe(startWith(null),untilDestroyed(this));
  }

  async login(): Promise<unknown> {
    return await this.authService.signIn();
  }

  async logout(): Promise<void> {
    await this.authService.signOut();
  }
}
