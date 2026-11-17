# Plan: CDK: move the duplicated firebase-domain.ts into a shared infra lib

Spec: [docs/specs/2991-cdk-move-the-duplicated-firebase-domain-ts-into-a-shared-infra-lib.md](../specs/2991-cdk-move-the-duplicated-firebase-domain-ts-into-a-shared-infra-lib.md)

1. **Record the baseline synth.** Run both apps' `main.ts` with `tsx`, `RELEASE_VERSION=0.0.0`
   and `CDK_OUTDIR` in the scratchpad; keep the `cdk.out` folders. No commit.
2. **Create the lib with its spec first.**
   - Files: `libs/shared/firebase-domain-cdk/{project.json,package.json,README.md,jest.config.ts,
     tsconfig.json,tsconfig.lib.json,tsconfig.spec.json}`, `src/index.ts`,
     `src/lib/firebase-domain.spec.ts` (red: module missing), then `src/lib/firebase-domain.ts`
     (green), and the alias in `tsconfig.base.json`.
   - Tests: `nx test shared-firebase-domain-cdk`, `nx lint shared-firebase-domain-cdk`.
   - Commit: `feat(shared-firebase-domain-cdk): add the Firebase Hosting domain construct`.
3. **Switch both CDK apps to the lib.**
   - Files: both `main.ts`; delete both `firebase-domain.ts` and `firebase-domain.spec.ts`;
     `bacteria-game-remote-cdk`'s `main.ts` takes `envOrDie` from `@wolsok/spa-cdk-stack`.
   - Tests: `nx test korbjaeger-cdk`, `nx lint bacteria-game-remote-cdk korbjaeger-cdk`, and the
     synth diff against step 1 (must be empty).
   - Commit: `refactor(korbjaeger-cdk): take addFirebaseDomain from the shared infra lib`
     (both apps, one commit, so no state has the code three times).
4. **Format and affected checks**: `nx format:write`, `nx affected -t lint,test`.
