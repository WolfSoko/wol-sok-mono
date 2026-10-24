import { signal } from '@angular/core';
import { SignInCancelled } from '../../ports/account.port';

/**
 * Runs one account action at a time and remembers whether the last one
 * failed. A visitor closing the sign-in popup is not a failure.
 */
export class AccountAction {
  public readonly busy = signal(false);
  public readonly failed = signal(false);

  public async run(action: () => Promise<void>): Promise<void> {
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
