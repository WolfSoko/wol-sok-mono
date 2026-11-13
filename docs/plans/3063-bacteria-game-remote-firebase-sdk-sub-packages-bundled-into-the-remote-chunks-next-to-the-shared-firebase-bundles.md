# Plan: #3063 Firebase SDK sub-packages in the remote's chunks

Spec: [`docs/specs/3063-…`](../specs/3063-bacteria-game-remote-firebase-sdk-sub-packages-bundled-into-the-remote-chunks-next-to-the-shared-firebase-bundles.md)

The investigation is done (spec, Findings); what is left only writes it down.

1. **Spec and plan.** Files: this plan and the spec. Commit: `docs(bacteria-game-remote): spec and plan for #3063`.
2. **Record the finding.** Files: `CLAUDE.md` (a bullet in Native Federation), `tools/federation/workspace-federation.js` (comment above `skip`). Tests: none change; run `npx nx format:write`, `npx nx affected -t lint,lint-templates`. Commit: `docs(tools-federation): shared packages' chunk-* files are no duplicates`.
3. **PR** against `main` with `Closes #3063`, the acceptance results and the measurement in the body.
