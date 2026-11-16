# Plan: guard the shell's singletons against the remotes' (#3085)

Spec: [`docs/specs/3085-…`](../specs/3085-federation-guard-that-every-firebase-entry-a-remote-shares-is-also-in-the-shell-import-map.md)

1. **Rule, test first.** `tools/federation/shared-singletons/shared-singletons.spec.mjs` (node:test) for `missingSingletons` (acceptance 1), then `shared-singletons.mjs`. Commit `feat(federation-shared-singletons): report singletons a remote shares and the shell lacks`.
2. **Project and script.** `tools/federation/shared-singletons/project.json` (tag `tools`, empty `namedInputs`, `implicitDependencies`, `test` target with `dependsOn` and inputs as in the spec), `check-shared-singletons.mjs` (reads the manifest and the `remoteEntry.json` files, prints `::error::`, exits 1), and the spec for `implicitDependencies` (acceptance 2). Run `npx nx test federation-shared-singletons`, the mutated-shell run and `nx affected` by hand (acceptance 3-5). Same commit as 1 or its own: `feat(federation-shared-singletons): check the remotes' singletons after the federation builds`.
3. **Docs.** CLAUDE.md bullet in "Native Federation". Commit `docs(federation-shared-singletons): …` (scope must be a project; use `chore(federation-shared-singletons)` if `docs` is refused).
4. Before each commit: `npx nx format:write`, `npx nx affected -t lint,lint-templates --base=origin/main`, `npx nx test tools`.
