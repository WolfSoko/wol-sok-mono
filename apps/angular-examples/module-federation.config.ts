import { ModuleFederationConfig } from '@nx/webpack';
const config: ModuleFederationConfig = {
  name: 'angular-examples',
  remotes: [
    'fourier-analysis-remote',
    'bacteria-game-remote',
    'shader-examples-remote',
  ],
};

export default config;
