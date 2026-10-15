import { Observable } from 'rxjs';
import { Account } from '../../shared/account';

export abstract class AccountPort {
  /** The signed-in visitor, `null` when nobody is (always on the server). */
  abstract readonly account$: Observable<Account | null>;

  /**
   * Signs in with Google. An anonymous visitor keeps their uid, so their
   * votes and polls stay theirs. If that Google account already exists, the
   * visitor switches to it and the anonymous votes stay with the old uid.
   * Rejects with `SignInCancelled` when the visitor closes the popup.
   */
  abstract signInWithGoogle(): Promise<void>;

  abstract signOut(): Promise<void>;
}

export class SignInCancelled extends Error {
  constructor() {
    super('Sign-in cancelled');
    this.name = 'SignInCancelled';
  }
}
