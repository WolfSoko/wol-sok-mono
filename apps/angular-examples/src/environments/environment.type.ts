import { FirebaseOptions } from '@wolsok/feat-api-auth';

export interface Environment {
  version: string;
  production: boolean;
  serviceWorkerCheckInterval: number;
  firebaseConfig: FirebaseOptions;
}
