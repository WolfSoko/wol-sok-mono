import { ModuleFederationConfig } from '@nx/module-federation';
const config: ModuleFederationConfig = {
  name: 'angular-examples',
  remotes: [
    'fourier-analysis-remote',
    'bacteria-game-remote',
    'shader-examples-remote',
  ],
};

export default config;
