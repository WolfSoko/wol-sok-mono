import { inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  User,
} from '@angular/fire/auth';
import { createStore, select, withProps } from '@ngneat/elf';
import { Observable } from 'rxjs';
import { Profile } from '../profile';

export interface AuthState {
  uid: string;
  emailVerified: boolean;
  profile?: Profile;
  loading: boolean;
  error?: unknown;
}

const initialAuthState: AuthState = {
  uid: '',
  emailVerified: false,
  profile: undefined,
  loading: true,
};

@Injectable({ providedIn: 'root' })
export class AuthFacade {
  private readonly auth = inject(Auth);

  private readonly store = createStore(
    { name: 'AuthStore' },
    withProps<AuthState>(initialAuthState)
  );
  profile$: Observable<Profile | null> = this.store.pipe(
    select((state) => state.profile ?? null)
  );
  authenticated$: Observable<boolean> = this.store.pipe(
    select((state) => state.uid != null)
  );

  profile = toSignal(this.profile$);
  authenticated = toSignal(this.authenticated$);

  constructor() {
    this.auth.onAuthStateChanged((user) =>
      user ? this.updateStateLoggedIn(user) : this.updateStateLoggedOut()
    );
  }

  async signin(): Promise<AuthState> {
    this.setLoading(true);
    this.auth.useDeviceLanguage();

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      login_hint: 'user@example.com',
    });

    try {
      await signInWithPopup(this.auth, provider);
      return this.store.state;
    } catch (error) {
      console.error('Sign-in failed:', error);
      this.setLoading(false, { error });
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      this.setLoading(true);
      await this.auth.signOut();
    } catch (error) {
      this.setLoading(false, { error });
      console.error('Sign-out failed:', error);
    }
  }

  protected updateStateLoggedIn(user: User): void {
    this.store.update((state) => ({
      ...state,
      uid: user.uid,
      emailVerified: user.emailVerified,
      loading: false,
      profile: this.createProfile(user),
      error: undefined,
    }));
  }

  private updateStateLoggedOut() {
    this.store.update(() => ({
      ...initialAuthState,
      loading: false,
    }));
  }

  private setLoading(isLoading: boolean, extraProps?: Partial<AuthState>) {
    this.store.update((state) => ({
      ...state,
      loading: isLoading,
      ...extraProps,
    }));
  }

  protected createProfile({
    displayName,
    email,
    photoURL,
    uid,
  }: Profile): Profile {
    return {
      uid: uid,
      email: email,
      displayName: displayName,
      photoURL: photoURL,
    };
  }
}
