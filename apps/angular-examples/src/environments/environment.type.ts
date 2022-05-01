import { FirebaseOptions } from '@wolsok/feat-api-auth';

export interface Environment {
  production: boolean;
  serviceWorkerCheckInterval: number;
  firebaseConfig: FirebaseOptions;
}
