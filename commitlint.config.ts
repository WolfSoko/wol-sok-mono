import { default as configNx } from '@commitlint/config-nx-scopes';

export default {
  rules: {
    'scope-enum': async (ctx) => [
      2,
      'always',
      [...configNx.utils.getProjects(ctx), 'release'],
    ],
  },
};
