# Plan: rollapolla sitemap lists every public poll, including newly created ones

Spec: [docs/specs/3246-rollapolla-sitemap-lists-every-public-poll-including-newly-created-ones.md](../specs/3246-rollapolla-sitemap-lists-every-public-poll-including-newly-created-ones.md)

## Task 1: spec for `listedPolls()`

- File: `apps/rollapolla-analog/src/server/sitemap/listed-polls.spec.ts`
- Mock `firebase/app` and `firebase/firestore/lite`; check the query
  constraints, the mapping (`ttl` to `closesAt`), the skip of a document
  without `ttl`, and the timeout with fake timers.
- Check: `npx nx test rollapolla-analog`.

## Task 2: spec for the `/sitemap.xml` route

- File: `apps/rollapolla-analog/src/server/routes/sitemap.xml.spec.ts`
- Mock `../sitemap/listed-polls`; call the handler with a minimal h3 event;
  check the listed poll in the XML with the one-hour cache, and the fallback
  with the one-minute cache.
- Check: `npx nx test rollapolla-analog`, `typecheck-specs`, lint.
- Commit (both tasks together, the PR is squash-merged): `test(rollapolla-analog): cover the dynamic sitemap`

## Task 3: PR

- Spec, plan and both specs in one PR, `Closes #3246`, acceptance results in
  its description.
