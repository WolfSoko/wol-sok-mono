import { firebaseOptions } from './firebase.options';
import { RollaPollaEnv } from './rolla-polla.env';

export const environment: RollaPollaEnv = {
  isDev: true,
  isProduction: false,
  useEmulator: false,
  firebaseOptions,
};
