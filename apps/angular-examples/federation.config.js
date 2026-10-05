/* eslint-disable @nx/enforce-module-boundaries -- federation.config.js is
   read by the native federation builder from disk, so it cannot use the
   workspace's TypeScript path aliases. */
const {
  workspaceFederation,
} = require('../../tools/federation/workspace-federation');

module.exports = workspaceFederation({
  name: 'angular-examples',
});
