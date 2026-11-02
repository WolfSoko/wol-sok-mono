import { Environment } from './environment.type';
import { environment as emulator } from './environment.emulator';

/**
 * The production build for e2e: everything as shipped, but the progress
 * goes to the local emulators, never to the game's real project, and no
 * ads are asked for.
 */
export const environment: Environment = {
  production: true,
  gameCloud: emulator.gameCloud,
  support: emulator.support,
};
