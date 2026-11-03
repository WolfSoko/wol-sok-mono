# utils-version

The workspace's release version, read from the root `version.json` (written
by the release workflow). This lib is the one place that reads the file:
projects import `@wolsok/utils-version` instead of reaching for the root by
relative path, so the dependency shows in the project graph and
`version.json` is an input of every task that depends on it.

```ts
import { releaseName, WORKSPACE_VERSION } from '@wolsok/utils-version';

WORKSPACE_VERSION; // '74.136.4'
releaseName('bacteria-wars'); // 'bacteria-wars@v74.136.4', the Sentry release
```

Run `nx test utils-version` for its specs.
