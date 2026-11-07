# Plan: angular-examples-cdk reads version.json directly instead of @wolsok/utils-version

Spec: [docs/specs/2841-angular-examples-cdk-reads-version-json-directly-instead-of-wolsok-utils-version.md](../specs/2841-angular-examples-cdk-reads-version-json-directly-instead-of-wolsok-utils-version.md)

1. **Spec and plan.** Files: `docs/specs/2841-…md`, `docs/plans/2841-…md`.
   Commit: `docs(angular-examples-cdk): spec and plan for reading the version through utils-version`.
2. **Allow infra to use utils-version.** Add the tag `infra-shared` to
   `libs/utils/version/project.json`. Check: a temporary import from
   `angular-examples-cdk` fails `nx lint` before, passes after.
3. **Read the version through the lib.** `apps/angular-examples-cdk/src/main.ts`:
   import `WORKSPACE_VERSION`, drop `readFileSync`/`join` and the string guard,
   pass `WORKSPACE_VERSION` to `Source.jsonData('version.json', …)`.
   Tests: `nx lint angular-examples-cdk utils-version`, `nx test utils-version`,
   local synth (acceptance 4), `nx graph --file` edge (acceptance 2).
   Commit (steps 2 and 3 together): `fix(angular-examples-cdk): read the workspace version through utils-version`.
4. **PR**, review, test, merge as the end-to-end role says.
