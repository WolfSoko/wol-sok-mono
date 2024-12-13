import { effect, inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Angulartics2 } from 'angulartics2';
import { Profile } from './profile';
import { AuthFacade } from './fire-auth';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationService {
  private readonly authFacade = inject(AuthFacade);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  constructor() {
    const angulartics = inject(Angulartics2);
    effect(() => {
      angulartics.setUsername.next('' + this.authFacade.profile()?.uid);
    });
  }

  async signIn(): Promise<Profile | null> {
    try {
      return (await this.authFacade.signin()).profile ?? null;
    } catch (error) {
      console.log('Error sign in: ', error);
      const matSnackBarRef = this.snackBar.open(
        'Upps, there was an error while signing in. Try again later.',
        'Retry now!',
        {
          duration: 6000,
          horizontalPosition: 'right',
          verticalPosition: 'top',
        }
      );
      matSnackBarRef.onAction().subscribe(() => this.signIn());
    }
    return null;
  }

  async signOut(): Promise<void> {
    try {
      await this.router.navigate(['/']);
      await this.authFacade.signOut();
    } catch (error) {
      console.log('Error sign out: ', error);
      this.snackBar.open('Error signing out. Please try again.', undefined, {
        duration: 6000,
        horizontalPosition: 'right',
        verticalPosition: 'top',
      });
    }
  }
}
