# spa-cdk-stack

This is a stack for deploying a single page application (SPA) stack to AWS using AWS CDK.
It creates an S3 bucket and a CloudFront distribution to serve the SPA.

Features are:

- Deployment of your build files to the S3 bucket.
- Cloudfront invalidation with deployment
- Creation of a certificate for your domain (only possible if region is us-east-1).
- Redirect from HTTP to HTTPS with an ACM certificate.
- Route53 alias record creation,

## Usage

`SpaStack` is a stack holding one `SpaConstruct`. Use it as is, or extend it and
call `this.spa.addExtraAssets(...)` to deploy further files with their own cache
headers:

```ts
new SpaStack(app, 'MyApp', {
  env: { region: 'us-east-1', account: '123456789012' },
  buildOutputPath: 'dist/apps/my-app',
  domainName: 'my-app.example.com',
  noCacheFiles: ['remoteEntry.json'],
});
```

## Building

## Running unit tests

Run `nx test spa-cdk-stack` to execute the unit tests via [Vitest](https://vitest.dev/).
