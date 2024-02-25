# spa-cdk-stack

This is a stack for deploying a single page application (SPA) stack to AWS using AWS CDK.
It creates an S3 bucket and a CloudFront distribution to serve the SPA.

Features are:

- Deployment of your build files to the S3 bucket.
- Cloudfront invalidation with deployment
- Redirect from HTTP to HTTPS with an ACM certificate.
- Route53 alias record creation,

## Building

## Running unit tests

Run `nx test spa-cdk-stack` to execute the unit tests via [Vitest](https://vitest.dev/).
