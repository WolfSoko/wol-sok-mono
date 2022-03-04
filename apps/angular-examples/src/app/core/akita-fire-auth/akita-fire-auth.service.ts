import {Injectable} from '@angular/core';
import {CollectionConfig, FireAuthService} from 'akita-ng-fire';
import firebase from 'firebase';
import {Profile} from '../profile';
import {AkitaAuthState, AkitaAuthStore} from './akita-fire-auth.store';

@Injectable({ providedIn: 'root' })
@CollectionConfig({ path: 'users' })
export class AkitaFireAuthService extends FireAuthService<AkitaAuthState> {
  constructor(store: AkitaAuthStore) {
    super(store);
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

  protected async onSignin(
    userCredential: firebase.auth.UserCredential
  ): Promise<void> {
    if (userCredential.user) {
      await this.update(this.createProfile(userCredential.user));
    }
  }
}
