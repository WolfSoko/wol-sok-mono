module.exports = {
  name: 'bacteria-game-remote',
  exposes: {
    './Routes': 'apps/bacteria-game-remote/src/app/remote-entry/entry.routes.ts',
  },
};
