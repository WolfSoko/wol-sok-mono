import { Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Angulartics2 } from 'angulartics2';
import { tap } from 'rxjs/operators';
import { AkitaAuthQuery, AkitaFireAuthService } from './akita-fire-auth';
import { Profile } from './profile';

@Injectable({
  providedIn: 'root'
})
export class AuthenticationService {

  constructor(private afAuth: AkitaFireAuthService, private akitaAuthQuery: AkitaAuthQuery, private router: Router,
              angulartics: Angulartics2,
              private snackBar: MatSnackBar) {
    afAuth.sync().subscribe();
    this.akitaAuthQuery.select().pipe(
      tap(user => angulartics.setUsername.next(('' + user.uid))),
    ).subscribe();
  }

  async signIn(): Promise<Profile | null> {
    try {
      return (await this.afAuth.signin('google')).user;
    } catch (error) {
      console.log('Error sign in: ', error);
      const matSnackBarRef = this.snackBar.open('Upps, there was an error while signing in. Try again later.',
        'Retry now!', {
          duration: 6000, horizontalPosition: 'right', verticalPosition: 'top'
        });
      matSnackBarRef.onAction().subscribe(() => this.signIn());
    }
    return null;
  }


  async signOut(): Promise<void> {
    try {
      await this.router.navigate(['/']);
      await this.afAuth.signOut();
    } catch (error) {
      console.log('Error sign out: ', error);
      this.snackBar.open('Error signing out', undefined, {
        duration: 6000, horizontalPosition: 'right', verticalPosition: 'top'
      });
    }
  }
}
