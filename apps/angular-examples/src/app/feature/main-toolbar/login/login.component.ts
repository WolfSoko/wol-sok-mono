import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatLegacyButtonModule as MatButtonModule } from '@angular/material/legacy-button';
import { MatIconModule } from '@angular/material/icon';
import { MatLegacyTooltipModule as MatTooltipModule } from '@angular/material/legacy-tooltip';
import { UntilDestroy, untilDestroyed } from '@ngneat/until-destroy';
import {
  AuthenticationService,
  AuthQuery,
  Profile,
} from '@wolsok/feat-api-auth';
import { Observable } from 'rxjs';
import { startWith } from 'rxjs/operators';

@UntilDestroy()
@Component({
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatTooltipModule, MatIconModule],
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  user$: Observable<Profile | null>;

  constructor(
    private authQuery: AuthQuery,
    private authService: AuthenticationService
  ) {
    this.user$ = this.authQuery.profile$.pipe(
      startWith(null),
      untilDestroyed(this)
    );
  }

  async login(): Promise<unknown> {
    return await this.authService.signIn();
  }

  async logout(): Promise<void> {
    await this.authService.signOut();
  }
}
