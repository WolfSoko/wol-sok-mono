import { ModuleFederationConfig } from '@nx/webpack';

const config: ModuleFederationConfig = {
  name: 'angular-examples',
  remotes: [
    ['bacteria-game-remote', 'https://bacteria-game.wolsok.de'],
    ['fourier-analysis-remote', 'https://fourier-analysis.wolsok.de'],
    ['shader-examples-remote', 'https://shader-examples.wolsok.de'],
  ],
};
export default config;
