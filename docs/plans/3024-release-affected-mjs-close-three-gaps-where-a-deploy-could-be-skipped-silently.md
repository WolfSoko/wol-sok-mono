# Plan #3024: release-affected.mjs: close three gaps where a deploy could be skipped silently

Spec: [docs/specs/3024-…](../specs/3024-release-affected-mjs-close-three-gaps-where-a-deploy-could-be-skipped-silently.md)

All in `tools/ci/`, one commit
(`fix(tools): keep Nx's verdict for nx.json and wildcard aliases in release selection`),
since the three changes share the same rule and test file.

1. **Tests first** (`release-affected.test.mjs`):
   - `selectReleaseAffected`: `nx.json` keeps every candidate;
     `tsconfig.base.json` as changed file keeps every candidate; a candidate
     whose `inputsOf` returns `undefined` is kept with
     `Nx's verdict: its inputs could not be read`, the others still filtered.
   - `tsconfigBaseChanges`: a new, removed or retargeted wildcard alias
     (`@wolsok/*` → `./libs/*/src`) and a literal alias retargeted to a
     wildcard target return `['tsconfig.base.json']`.
   - `keepsNxVerdict`: `nx.json` and `tsconfig.base.json` hold.
   - Run `npx nx test tools`: the new cases fail.
2. **Code** (`release-affected.mjs`): `keepsNxVerdict` adds `nx.json` and
   the base; `tsconfigBaseChanges` returns the base when a changed alias or
   target holds `*`; doc comments say why.
3. **Docs**: `CLAUDE.md` "What a release deploys".
4. **Checks**: `npx nx test tools`, `npx nx lint tools --fix`,
   `npx nx format:write`, and `node tools/ci/release-affected.mjs
   --files=nx.json --target=deploy` against `nx show projects --affected
   --files=nx.json --withTarget=deploy`.
