# Plan #3054: count a deleted file only for the projects reading its owner

Spec: [docs/specs/3054-release-affected-a-file-deleted-inside-one-project-keeps-nx-s-verdict-for-every-project.md](../specs/3054-release-affected-a-file-deleted-inside-one-project-keeps-nx-s-verdict-for-every-project.md)

## 1. Owner of a deleted file (pure)

- `tools/ci/release-affected.mjs`: `ownerRoot(file, roots)`: the longest
  root that is a prefix of `file` up to a `/`, never `.`; `undefined` where
  none is.
- `tools/ci/release-affected.test.mjs`: nested roots, the root project, a
  root file, a sibling with a shared name prefix (`libs/a` vs `libs/ab/x`).
- Commit: `fix(tools): find the project a deleted file belonged to`.

## 2. Deletions in `selectReleaseAffected` (pure)

- `selectReleaseAffected` takes `projectRoots` (project to root, or
  `undefined` where unread). `nxVerdictReason` keeps Nx's verdict for a
  deletion only without roots or without an owner; `inputReason` then also
  checks each placed deletion against the candidate's inputs (a file under
  the owner's root), with the reason `reads <root>/, where <file> was
  deleted`.
- Specs: acceptance 1-4 with the `INPUTS` fixture; the existing deletion
  spec moves to a file outside every root.
- Commit: `fix(tools): count a deleted file only for the projects reading its owner`.

## 3. CLI reads the roots

- `main`: when `deletedFiles` is non-empty, `nx graph --file=<tmp>.json`
  into `projectRoots`; a failure logs and passes `undefined`.
- Workspace spec: `--files=<a deleted path under apps/pacetrainer>`
  `--target=deploy` selects `pacetrainer` only (the `--files` form treats a
  missing file as deleted).
- Run acceptance 5 by hand over #3029 and note the output in the PR.
- Commit together with 2 if the spec needs the CLI.

## 4. Docs

- CLAUDE.md, "What a release deploys": a deleted file counts for the
  projects reading its project's files; only one outside every project keeps
  Nx's verdict.
- Commit: together with 3.
