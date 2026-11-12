# Plan #3058: Release deploy shipped a stale korbjaeger build from the Nx remote cache

Spec: [docs/specs/3058-…](../specs/3058-release-deploy-shipped-a-stale-korbjaeger-build-from-the-nx-remote-cache-deploy-yml-has-no-way-to-skip-the-cache.md)

1. **Spec and plan** (`docs/specs/`, `docs/plans/`), commit
   `docs(tools): spec and plan for redeploying a release without the cache`.
2. **Spec first** (`tools/ci/deploy-workflow.test.mjs`, picked up by
   `npx nx test tools`): parses `.github/workflows/deploy.yml` and fails on
   acceptance 1, 2, 4 and 5; for 3, runs `nx show projects
   --projects=korbjaeger --exclude=<pattern>` with each leg's pattern from the
   matrix and expects `korbjaeger` in `non-cdk` only. Red before step 3.
3. **`deploy.yml`**: the two `workflow_dispatch` inputs, `NX_SKIP_NX_CACHE` in
   the job env, the override branch in the selection step (an
   `exclude-pattern` for the npm leg, `*,!tag:published`), the tagging guard,
   `--output-style=static` on the three Nx calls. Commit with step 2,
   `fix(tools): redeploy a release without the Nx cache and show what each deploy did`.
4. **Docs**: `CLAUDE.md` "What a release deploys" gets the inputs and the
   visible output, same commit.
5. **Checks**: `npx nx format:write`, `npx nx test tools`,
   `npx nx affected -t lint,lint-templates --base=origin/main`.
6. **PR** to `main` with `Closes #3058`; the investigation (spec, "What the
   investigation found") in its body.
