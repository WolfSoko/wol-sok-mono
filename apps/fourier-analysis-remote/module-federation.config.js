module.exports = {
  name: 'fourier-analysis-remote',
  exposes: [
    {
      './Module':
        'apps/fourier-analysis-remote/src/app/remote-entry/entry.module.ts',
    },
    {
      './Routes':
        'apps/fourier-analysis-remote/src/app/remote-entry/entry.routes.ts',
    },
  ],
};
