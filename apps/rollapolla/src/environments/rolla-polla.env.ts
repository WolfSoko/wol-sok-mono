import { FirebaseOptions } from '@firebase/app';

export interface RollaPollaEnv {
  isProduction: boolean;
  useEmulator: boolean;
  isDev: boolean;
  firebaseOptions: FirebaseOptions;
}
