import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AccountPort, SignInCancelled } from '../../ports/account.port';

@Component({
  selector: 'rap-account',
  imports: [MatButtonModule, MatIconModule],
  templateUrl: './account.component.html',
  styleUrl: './account.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountComponent {
  private readonly accountPort = inject(AccountPort);

  protected readonly account = toSignal(this.accountPort.account$, {
    initialValue: null,
  });
  /** Signed in with Google, not just the automatic anonymous sign-in. */
  protected readonly googleAccount = computed(() => {
    const account = this.account();
    return account && !account.isAnonymous ? account : null;
  });
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected async signIn(): Promise<void> {
    await this.run(() => this.accountPort.signInWithGoogle());
  }

  protected async signOut(): Promise<void> {
    await this.run(() => this.accountPort.signOut());
  }

  private async run(action: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.failed.set(false);
    try {
      await action();
    } catch (error) {
      if (!(error instanceof SignInCancelled)) {
        console.error('Account action failed', error);
        this.failed.set(true);
      }
    } finally {
      this.busy.set(false);
    }
  }
}
