# CDK: move the duplicated firebase-domain.ts into a shared infra lib

Issue: [#2991](https://github.com/WolfSoko/wol-sok-mono/issues/2991)

## Goal

`addFirebaseDomain` (the Route53 CNAME a Firebase Hosting custom domain needs) exists once, in a
shared infra lib with one spec, and both `bacteria-game-remote-cdk` and `korbjaeger-cdk` use it.
Today `apps/bacteria-game-remote-cdk/src/firebase-domain.ts` and
`apps/korbjaeger-cdk/src/firebase-domain.ts` hold the same code (they differ only in one doc
comment sentence), each with a near-identical spec.

The synthesized stacks stay byte for byte the same, so the next deploy changes no DNS record.

## Non-goals

- No change to the construct's behaviour, its logical ids (`FirebaseDomainZone`,
  `FirebaseHostingRecord`) or its props.
- No change to the stacks' names, accounts, regions or tags.
- No move into `@wolsok/spa-cdk-stack`: that is a published package (`libs/public`), and the
  CNAME helper is workspace infra, not part of its API.
- No change to the other CDK apps.

## Decisions

- **New lib `shared-firebase-domain-cdk`** at `libs/shared/firebase-domain-cdk`, alias
  `@wolsok/shared-firebase-domain-cdk`, tag `infra-shared` only: `.oxlintrc.json` lets `infra`
  projects depend only on `infra-shared` libs, and `infra-shared` only on `infra-shared`. Private
  (`"private": true` in its `package.json`), MIT like the repository; it takes the code of
  `bacteria-game-remote-cdk`, which is MIT, so nothing comes only from the proprietary
  `korbjaeger-cdk` folder (#2956). It is not listed in the root `LICENSE`'s proprietary list.
- **Its `tsconfig.json` extends `tsconfig.cdk.json`**, like the CDK apps it is compiled into
  (Node runtime, `target: ESNext`), with the lib/spec tsconfig split and a Jest `test` target as
  `utils-version` has.
- **One spec in the lib**, covering both things the two specs checked: the domain points at
  `<site>.web.app` as a CNAME, once, and the record keeps its logical id. The stack in the spec is
  neutral (`Stack` id `FirebaseDomainSpec`, an example domain), since the lib knows neither app.
- **The doc comment** keeps the generic sentence ("under a fixed id"); the game's historical
  reason ("since the old site shared the stack") moves to the game's `main.ts`, beside the
  existing comment about the old site.
- **Both apps' `firebase-domain.ts` and `firebase-domain.spec.ts` are deleted**; each `main.ts`
  imports `addFirebaseDomain` from the alias.
- **Cleanup of the touched `main.ts`**: `bacteria-game-remote-cdk` reads `RELEASE_VERSION` with
  a copy of `envOrDie` of its own; it takes `envOrDie` from `@wolsok/spa-cdk-stack` as
  `korbjaeger-cdk` does (same error text, same behaviour).
- **Proof that nothing changes**: before and after the move, synthesize both apps' `main.ts`
  (`tsx --tsconfig <app>/tsconfig.app.json`, with `RELEASE_VERSION` and `CDK_OUTDIR` set, no AWS
  credentials, so the zone lookup uses CDK's dummy as in the specs) and diff the templates.
  Recorded in the PR.

## Acceptance

1. `libs/shared/firebase-domain-cdk` exists with `addFirebaseDomain` and `FirebaseDomainProps`,
   tag `infra-shared`, and its spec passes (`nx test shared-firebase-domain-cdk`).
2. Neither CDK app has a `firebase-domain.ts` or `firebase-domain.spec.ts` any more; both
   `main.ts` import from `@wolsok/shared-firebase-domain-cdk`.
3. The synthesized `BacteriaGame` and `Korbjaeger` templates (and their manifests' missing
   context) are identical before and after.
4. `nx lint` (boundaries included) and `nx test` pass for the new lib and both CDK apps;
   `korbjaeger-cdk`'s `korbjaeger-site.spec.ts` still passes.
5. `nx format:check` passes.

## Open questions

None.
