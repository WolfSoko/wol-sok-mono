import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  MAT_TOOLTIP_SCROLL_STRATEGY_FACTORY_PROVIDER,
  MatTooltipModule,
} from '@angular/material/tooltip';
import {
  AuthenticationService,
  AuthFacade,
  Profile,
} from '@wolsok/feat-api-auth';

@Component({
  imports: [MatButtonModule, MatTooltipModule, MatIconModule],
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MAT_TOOLTIP_SCROLL_STRATEGY_FACTORY_PROVIDER],
})
export class LoginComponent {
  private readonly authService = inject(AuthenticationService);

  user: Signal<Profile | undefined | null> = inject(AuthFacade).profile;

  async login(): Promise<unknown> {
    return await this.authService.signIn();
  }

  async logout(): Promise<void> {
    await this.authService.signOut();
  }
}
