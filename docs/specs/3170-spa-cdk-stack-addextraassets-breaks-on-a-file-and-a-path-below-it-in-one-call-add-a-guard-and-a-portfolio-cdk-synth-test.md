# Spec: guard `addExtraAssets` against a file and a path below it in one call

Issue: [#3170](https://github.com/WolfSoko/wol-sok-mono/issues/3170). Related: [#3165](https://github.com/WolfSoko/wol-sok-mono/pull/3165), [#3168](https://github.com/WolfSoko/wol-sok-mono/issues/3168), [#3169](https://github.com/WolfSoko/wol-sok-mono/pull/3169).

## Goal

`SpaConstruct.addExtraAssets` (`libs/public/spa-cdk-stack/src/lib/spa/spa.construct.ts`) makes one
`BucketDeployment` per call, and its Lambda unpacks every source of that deployment into one folder.
A file `blog` beside a file `blog/x` in one call fails only at deploy time with
`[Errno 20] Not a directory`, and the stack rolls back. The construct should refuse such a call at
synth, with a message naming the path, and say so in its JSDoc; `portfolio-cdk` should get a synth
test that builds its stack from a build output with nested pages.

## Non-goals

- Splitting the sources into several deployments inside the library. Callers decide the grouping
  (cache header, order); `portfolio-cdk` already groups by depth (`pagesByDepth`).
- Checking sources that are no local asset (`Source.bucket`): their content is unknown at synth.
- Changing what the portfolio deploys.

## Decisions

1. **Guard over the staged asset folders.** `ISource` is opaque, so the construct cannot see the
   keys of `Source.data('blog', …)`. But every `Source.asset`/`Source.data`/`Source.jsonData` binds
   an `aws-s3-assets` `Asset` as a child of the deployment, staged by an `AssetStaging` (child
   `Stage`). After creating the deployment, the construct walks each such staging's
   `absoluteStagedPath` (which honours `exclude`, and is the source folder when staging is
   disabled), collects every file and folder path, and throws when one source's file is another
   source's folder. Reason: it catches every kind of local source, not only `Source.data`, and
   fails at synth, before anything reaches AWS. A zip file asset (`Source.asset('x.zip')`) is not a
   folder and is skipped.
2. **Applies to every upload of the construct** (`addUpload`), not only `addExtraAssets`: the build
   output, index and override deployments each have one source, so the guard costs nothing there,
   and a future multi-source upload is covered too.
3. **Only across sources.** Within one source folder a path cannot be both file and folder.
4. **`ValidationError`-style message**: `addExtraAssets: "blog" is a file in one source and a folder
   in another of the same deployment; S3 deployments unpack all sources into one folder, so add them
   in separate addExtraAssets calls.` A plain `Error`, as the construct's `onlyInclude` throws.
5. **portfolio-cdk synth test.** `main.ts` builds its stack inline at import from
   `dist/apps/portfolio`. Its stack setup moves into `src/portfolio.stack.ts`
   (`createPortfolioStack(app, buildOutputPath)`); `main.ts` keeps the `App`, the call and the tags.
   `portfolio.stack.spec.ts` writes a temporary build output (`index.html`, `career/`, `blog/`,
   `blog/<slug>/`), builds the stack and asserts that it synthesizes, with one extra deployment per
   page depth and each page's bare-path upload `no-cache` and `text/html`.
6. **Release**: the guard is a `fix(spa-cdk-stack)`, so the version job bumps the published package
   (patch).

## Acceptance

1. `addExtraAssets([Source.data('blog', …), Source.data('blog/x', …)])` throws at synth, naming
   `blog`.
2. The same files in two calls synthesize.
3. Sources without a shared path (`career`, `blog` in one call) synthesize, also with
   `Source.asset` folders and `exclude`.
4. The JSDoc of `addExtraAssets` and the README name the limit.
5. `portfolio-cdk`'s new spec synthesizes the stack from a build output with nested pages and fails
   if the bare-path pages of two depths go into one call.
6. `nx test spa-cdk-stack`, `nx test portfolio-cdk`, lint and `typecheck-specs` are green;
   the existing snapshots stay as they are.

## Open questions

None.
