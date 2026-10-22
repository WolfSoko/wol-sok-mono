import { Environment } from './environment.type';

export const environment: Environment = {
  production: true,
  // TODO: the web app config of the game's own Firebase project, from the
  // console (Project settings > Your apps). Until then progress stays on the
  // device.
  gameCloud: null,
};
