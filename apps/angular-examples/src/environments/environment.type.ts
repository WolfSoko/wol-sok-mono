import {FirebaseOptions} from '@angular/fire';

export interface Environment {
  production: boolean;
  serviceWorkerCheckInterval: number;
  firebaseConfig: FirebaseOptions;
}
