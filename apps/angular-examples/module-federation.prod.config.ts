import { ModuleFederationConfig } from '@nx/module-federation';

const config: ModuleFederationConfig = {
  name: 'angular-examples',
  remotes: [],
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
