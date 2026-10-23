# spa-cdk-stack

This is a stack for deploying a single page application (SPA) stack to AWS using AWS CDK.
It creates an S3 bucket and a CloudFront distribution to serve the SPA.

Features are:

- Deployment of your build files to the S3 bucket.
- Cloudfront invalidation with deployment
- Creation of a certificate for your domain. CloudFront only takes certificates
  from us-east-1, so in any other region `SpaStack` puts it into a second stack,
  `<name>Certificate` in us-east-1, referenced across regions. Deploy such an
  app with `cdk deploy --all`, or name the SPA stack.
- Redirect from HTTP to HTTPS with an ACM certificate.
- Route53 alias record creation,

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

## Building

## Running unit tests

Run `nx test spa-cdk-stack` to execute the unit tests via [Vitest](https://vitest.dev/).
