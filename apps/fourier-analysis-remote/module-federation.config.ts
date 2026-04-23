import { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: 'fourier-analysis-remote',
  exposes: {
    './Routes':
      'apps/fourier-analysis-remote/src/app/remote-entry/entry.routes.ts',
  },
  shared: (libraryName, sharedConfig) =>
    libraryName === 'p5'
      ? {
          ...sharedConfig,
          singleton: false,
          strictVersion: false,
          requiredVersion: false,
        }
      : sharedConfig,
};

export default config;
