// Read by the native federation builder from disk, so no path aliases: the
// relative require is allowed for these files in .oxlintrc.json.
const {
  workspaceFederation,
} = require('../../tools/federation/workspace-federation');

module.exports = workspaceFederation({
  name: 'angular-examples',
});
