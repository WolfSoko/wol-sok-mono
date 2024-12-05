import { ModuleFederationConfig } from '@nx/module-federation';
const config: ModuleFederationConfig = {
  name: 'shader-examples-remote',
  exposes: {
    './Routes':
      'apps/shader-examples-remote/src/app/remote-entry/entry.routes.ts',
  },
};
export default config;
