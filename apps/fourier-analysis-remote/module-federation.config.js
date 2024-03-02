module.exports = {
  name: 'fourier-analysis-remote',
  exposes: {
    './Routes':
      'apps/fourier-analysis-remote/src/app/remote-entry/entry.routes.ts',
  },
};
