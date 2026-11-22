# Plan: the e2e readiness gate goes missing on Nx Cloud workers (#3120)

Spec: `docs/specs/3120-ci-bacteria-game-remote-e2e-wait-for-webserver-fails-after-0-s-on-nx-cloud-agents.md`

1. **Specs first** (`libs/shared/e2e-server/src/lib/nx-server.spec.ts`): add
   cases for another project's task, the own project's non-Playwright task, and
   the own project's `e2e`, `e2e-ci` and `e2e-ci--<file>` tasks. Watch them fail.
2. **`nxServer`** (`libs/shared/e2e-server/src/lib/nx-server.ts`): derive the
   project from `target` and wait only inside its Playwright tasks. Name the
   target pattern as a constant and rewrite the doc comment with the reason
   (nested `nx` graph builds, the plugin cache).
   Run `npx nx test shared-e2e-server`, `typecheck-specs`, `lint`.
3. **Docs**: in CLAUDE.md's Testing bullet, state the new condition and why.
   Commit 1–3 as `fix(shared-e2e-server): wait only inside the server's own e2e tasks (#3120)`.
4. **Verify by hand**: the reset/repro of acceptance 3, and the game's e2e
   through `nx` locally (acceptance 4).
5. **PR**, review, test list, merge as the end-to-end role says.
