import type { FirebaseOptions } from '@angular/fire/app';

export interface Environment {
  production: boolean;
  firebaseConfig: FirebaseOptions;
}
