import { Injectable } from '@angular/core';
import { CollectionConfig, FireAuthService } from 'akita-ng-fire';
import { Profile } from '../profile';
import { AkitaAuthState, AkitaAuthStore } from './akita-fire-auth.store';
import { UserCredential } from '@angular/fire/auth';

@Injectable({ providedIn: 'root' })
@CollectionConfig({ path: 'users' })
export class AkitaFireAuthService extends FireAuthService<AkitaAuthState> {
  constructor(store: AkitaAuthStore) {
    super(store);
  }

  protected override createProfile({ displayName, email, photoURL, uid }: Profile): Profile {
    return {
      uid: uid,
      email: email,
      displayName: displayName,
      photoURL: photoURL,
    };
  }

  protected override async onSignin(userCredential: UserCredential): Promise<void> {
    if (userCredential.user) {
      await this.update(this.createProfile(userCredential.user));
    }
    return undefined;
  }
}
