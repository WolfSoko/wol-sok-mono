# Plan: check the live index.html after each Hosting deploy

Spec: [docs/specs/3073-check-after-each-hosting-deploy-that-the-live-site-serves-the-built-index-html.md](../specs/3073-check-after-each-hosting-deploy-that-the-live-site-serves-the-built-index-html.md)

1. **Core** — test first: `tools/deploy/live-index.spec.ts` (match, mismatch then match, final mismatch with message, fetch error, non-200, config with object/array/none/several Hosting entries), then `tools/deploy/live-index.ts` (`checkLiveIndex`, `builtIndexPath`). Commit `feat(tools-deploy): check that the live site serves the built index.html`.
2. **CLI** — `tools/deploy/check-live-index.ts` (args, real `fetch`, `readFileSync`, exit code), tried by hand against the live sites. Same commit.
3. **Wire the deploys** — test first: `tools/deploy/deploy-targets.spec.ts` (each of the four `deploy` targets ends with the check on its config and URL) and the korbjaeger `firebase-deploy.spec.ts` (last command is the check, URL is `SITE_URL`; the Firebase deploy stays the command before it); then the four `project.json`s. Commit `feat(tools-deploy): run the live index check after each Hosting deploy`.
4. **Docs** — CLAUDE.md sentence. Same commit as 3.
5. Checks: `nx format:write`, `nx affected -t lint,lint-templates,test`.
