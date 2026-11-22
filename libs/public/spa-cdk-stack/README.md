# spa-cdk-stack

This is a stack for deploying a single page application (SPA) stack to AWS using AWS CDK.
It creates an S3 bucket and a CloudFront distribution to serve the SPA.

Features are:

- Deployment of your build files to the S3 bucket.
- CloudFront invalidation with every deployment; the deploy only waits for the
  one issued with index.html, the last upload
- Creation of a certificate for your domain. CloudFront only takes certificates
  from us-east-1, so in any other region `SpaStack` puts it into a second stack,
  `<name>Certificate` in us-east-1, referenced across regions. Deploy such an
  app with `cdk deploy --all`, or name the SPA stack, and bootstrap both
  regions.
- Redirect from HTTP to HTTPS with an ACM certificate.
- Route53 alias record creation,
- Optionally, a permanent redirect from `/path/` to `/path`.

## Usage

`SpaStack` is a stack holding one `SpaConstruct`. Use it as is, or extend it and
call `this.spa.addExtraAssets(...)` to deploy further files with their own cache
headers:

```ts
new SpaStack(app, 'MyApp', {
  env: { region: 'eu-central-1', account: '123456789012' },
  buildOutputPath: 'dist/apps/my-app',
  domainName: 'my-app.example.com',
  noCacheFiles: ['remoteEntry.json'],
});
```

Hashed bundles get a one year `max-age`. Files that keep their names across
releases go into `noCacheFiles`, and files that need another header or content
type go into `cacheOverrides`. Both take globs relative to `buildOutputPath`.
Those files are left out of the main upload, so each file is uploaded once with
one header.
The build output goes up first, then the overrides and extra assets, and
`index.html` last, so it never points at a bundle that is not there yet. No
upload prunes the bucket, so tabs still running an older release keep finding
its bundles:

```ts
new SpaStack(app, 'MyApp', {
  // ...
  noCacheFiles: ['remoteEntry.json', 'assets/federation.manifest*.json'],
  cacheOverrides: [
    {
      files: ['wasm/*.wasm'],
      cacheControl: CacheControl.maxAge(Duration.days(1)),
      contentType: 'application/wasm',
    },
  ],
});
```

Each `addExtraAssets` call is one deployment, which unpacks all its sources into
one folder. So a file and a path below it, such as a page uploaded under its bare
path `blog` and another under `blog/first-post`, cannot share a call: the
construct throws at synth (prerendered pages need no such uploads with
`resolveFolderIndex`, below). Add the deeper paths in a call of their own:

```ts
stack.spa.addExtraAssets(
  [Source.data('blog', blogHtml)],
  CacheControl.noCache()
);
stack.spa.addExtraAssets(
  [Source.data('blog/first-post', postHtml)],
  CacheControl.noCache()
);
```

CloudFront in front of S3 resolves no folder index, so a prerendered page at
`about/index.html` would answer `/about` with the `index.html` fallback. Set
`resolveFolderIndex: true` and a viewer-request CloudFront Function serves an
extension-less path (no `.` in its last segment) from its `index.html`, while
the browser keeps `/about`; the page needs no second upload under its bare path.
Add `redirectTrailingSlash: true` to redirect `/about/` to `/about`, so each
page keeps one URL:

```ts
new SpaStack(app, 'Site', {
  // ...
  resolveFolderIndex: true,
  redirectTrailingSlash: true,
});
```

Both options share one function, as a cache behaviour takes one per event; see
their doc comments.

## Building

## Running unit tests

Run `nx test spa-cdk-stack` to execute the unit tests via [Vitest](https://vitest.dev/).
