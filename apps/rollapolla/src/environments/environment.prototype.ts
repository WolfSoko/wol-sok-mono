import { firebaseOptions } from './firebase.options';
import { RollaPollaEnv } from './rolla-polla.env';

export const environment: RollaPollaEnv = {
  isDev: false,
  isProduction: false,
  useEmulator: true,
  firebaseOptions,
};
