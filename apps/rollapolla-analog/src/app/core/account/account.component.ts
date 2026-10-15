import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { isGoogleAccount } from '../../../shared/account';
import { AccountPort } from '../../ports/account.port';
import { AccountAction } from './account-action';

@Component({
  selector: 'rap-account',
  imports: [MatButtonModule, MatIconModule, RouterLink],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountComponent {
  private readonly accountPort = inject(AccountPort);

  protected readonly account = toSignal(this.accountPort.account$, {
    initialValue: null,
  });
  protected readonly googleAccount = computed(() => {
    const account = this.account();
    return isGoogleAccount(account) ? account : null;
  });
  protected readonly action = new AccountAction();

  protected signIn(): Promise<void> {
    return this.action.run(() => this.accountPort.signInWithGoogle());
  }

  protected signOut(): Promise<void> {
    return this.action.run(() => this.accountPort.signOut());
  }
}
