import { ModuleFederationConfig } from '@nx/webpack';
const config: ModuleFederationConfig = {
  name: 'angular-examples',
  remotes: [
    'bacteria-game-remote',
    'fourier-analysis-remote',
    'shader-examples-remote',
  ],
};

export default config;
