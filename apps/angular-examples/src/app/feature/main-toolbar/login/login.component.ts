import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthenticationService, AuthQuery, Profile } from '@wolsok/feat-api-auth';

@Component({
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatTooltipModule, MatIconModule],
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginComponent {
  user: Signal<Profile | undefined>;

  constructor(
    private authQuery: AuthQuery,
    private authService: AuthenticationService
  ) {
    this.user = toSignal(this.authQuery.profile$);
  }

  async login(): Promise<unknown> {
    return await this.authService.signIn();
  }

  async logout(): Promise<void> {
    await this.authService.signOut();
  }
}
