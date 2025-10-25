# Deployment Guide

This document describes the deployment workflows for the wol-sok-mono repository.

## Overview

The repository uses Nx deploy targets to standardize deployments across different project types:

1. **NPM Packages** - Published to npm registry (e.g., `@wolsok/thanos`)
2. **Firebase Apps** - Deployed to Firebase Hosting (e.g., pacetrainer, rollapolla-analog)
3. **AWS CDK Stacks** - Deployed to AWS using CDK (e.g., angular-examples-cdk)

## Project Tags

Projects are tagged to control which deployment workflow they use:

- `tag:published` - NPM packages that should be published to npm
- `tag:cdk` - AWS CDK infrastructure stacks
- No specific tag - Firebase or other non-CDK deployments

## NPM Package Deployment

### Projects

- `ws-thanos` - Angular directive for Thanos snap effect
- `spa-cdk-stack` - CDK construct library for SPA hosting

### Local Testing

Test deployment without actually publishing:

```bash
# Build and test publish
nx deploy ws-thanos --configuration=dry-run

# Or run manually
nx build ws-thanos
npm publish dist/libs/public/ws-thanos --access public --dry-run
```

### Manual Publishing

To publish manually (requires npm authentication):

```bash
# Login to npm if not already authenticated
npm login

# Build and publish
nx build ws-thanos --configuration=production
nx deploy ws-thanos
```

### CI/CD Publishing

NPM packages are automatically published when:

1. Changes affecting the package are merged to main
2. A release tag is created (e.g., `v4.8.7`)
3. The deploy workflow detects affected projects with `tag:published`

The workflow:
- Runs `nx affected --target=deploy --projects='tag:published'`
- Authenticates with npm using `NPM_TOKEN` secret
- Publishes packages to npm registry
- Tags the deployment as `{version}-npm-deployed`

## Firebase App Deployment

### Projects

- `pacetrainer` - Pace training app
- `rollapolla-analog` - Rollapolla analog app

### Local Testing

```bash
# Build and deploy to Firebase
nx deploy pacetrainer
```

### CI/CD Deployment

Firebase apps are automatically deployed when:

1. Changes affecting the app are merged to main
2. A release is created
3. The deploy workflow detects affected projects without `tag:cdk` or `tag:published`

The workflow:
- Runs `nx affected --target=deploy --exclude='tag:cdk,tag:published'`
- Authenticates with Firebase using `FIREBASE_TOKEN` secret
- Deploys apps to Firebase Hosting
- Tags the deployment as `{version}-non-cdk-deployed`

## AWS CDK Stack Deployment

### Projects

- `angular-examples-cdk` - CDK stack for angular-examples app
- `fourier-analysis-remote-cdk` - CDK stack for fourier analysis
- `shader-examples-remote-cdk` - CDK stack for shader examples
- `bacteria-game-remote-cdk` - CDK stack for bacteria game

### Local Testing

```bash
# Deploy CDK stack
nx deploy angular-examples-cdk
```

### CI/CD Deployment

CDK stacks are automatically deployed when:

1. Changes affecting the stack are merged to main
2. A release is created
3. The deploy workflow detects affected projects with `tag:cdk`

The workflow:
- Runs `nx affected --target=deploy --projects='tag:cdk'`
- Authenticates with AWS using `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
- Deploys stacks using CDK
- Tags the deployment as `{version}-cdk-deployed`

## Deployment Workflow

The main deployment workflow is triggered by:

1. **Release Creation** - When a release tag (e.g., `v4.8.7`) is pushed
2. **Manual Trigger** - Via GitHub Actions UI with version input

### Workflow Steps

1. **Checkout** - Checks out the release tag
2. **Install Dependencies** - Installs npm dependencies
3. **Find Previous Deployment** - Determines affected projects since last deployment
4. **Show Affected Projects** - Lists projects that need deployment
5. **Deploy** - Runs `nx affected --target=deploy` with appropriate filters
6. **Tag Deployment** - Tags successful deployments for tracking

### Matrix Strategy

The workflow runs three parallel jobs:

1. **npm-packages** - Deploys projects with `tag:published`
2. **non-cdk** - Deploys projects without `tag:cdk` or `tag:published`
3. **cdk** - Deploys projects with `tag:cdk`

## Required Secrets

Configure these secrets in GitHub repository settings:

- `NPM_TOKEN` - npm authentication token for publishing packages
- `FIREBASE_TOKEN` - Firebase authentication token for deploying apps
- `AWS_ACCESS_KEY_ID` - AWS access key for CDK deployments
- `AWS_SECRET_ACCESS_KEY` - AWS secret key for CDK deployments
- `NX_CLOUD_ACCESS_TOKEN` - Nx Cloud token for caching (optional)

## Adding Deploy Target to New Projects

### NPM Package

Add to `project.json`:

```json
{
  "tags": ["shared", "published"],
  "targets": {
    "deploy": {
      "executor": "nx:run-commands",
      "inputs": [
        "production",
        "^production",
        "{projectRoot}/package.json"
      ],
      "dependsOn": ["build"],
      "options": {
        "command": "npm publish dist/{projectRoot} --access public"
      },
      "configurations": {
        "dry-run": {
          "command": "npm publish dist/{projectRoot} --access public --dry-run"
        }
      }
    }
  }
}
```

### Firebase App

Add to `project.json`:

```json
{
  "tags": ["app", "type:firebase"],
  "targets": {
    "deploy": {
      "executor": "nx:run-commands",
      "inputs": [
        "production",
        "^production",
        "{workspaceRoot}/firebase.{projectName}.json"
      ],
      "dependsOn": ["build"],
      "options": {
        "command": "nx run {projectName}:firebase deploy"
      }
    }
  }
}
```

### AWS CDK Stack

Add to `project.json`:

```json
{
  "tags": ["infra", "cdk"],
  "targets": {
    "deploy": {
      "executor": "@wolsok/nx-aws-cdk-v2:deploy",
      "dependsOn": ["^build"],
      "options": {
        "output": "{workspaceRoot}/dist/{projectRoot}",
        "require-approval": "never"
      }
    }
  }
}
```

## Troubleshooting

### Deployment Not Triggered

Check:
1. Does the project have a `deploy` target in `project.json`?
2. Are there affected changes? Run `nx show projects --affected -t deploy`
3. Are the tags correct? Check project tags match the deployment type

### NPM Publish Fails

Check:
1. Is `NPM_TOKEN` secret configured in GitHub?
2. Does the package version in `package.json` already exist on npm?
3. Run locally with `--dry-run` to test package structure

### Firebase Deploy Fails

Check:
1. Is `FIREBASE_TOKEN` secret configured in GitHub?
2. Does the Firebase project exist and have correct permissions?
3. Is the `firebase.{projectName}.json` file configured correctly?

### CDK Deploy Fails

Check:
1. Are AWS credentials configured in GitHub secrets?
2. Has the CDK stack been bootstrapped? Run `nx run {project}:bootstrap`
3. Are there any resource conflicts in AWS?

## Future Enhancements

Planned improvements for the deployment workflow:

1. **Unified CDK Deployment** - Bring all CDK stacks under standardized Nx targets
2. **Deployment Environments** - Support for dev/staging/production environments
3. **Rollback Support** - Automated rollback on deployment failures
4. **Deployment Approval** - Manual approval gates for production deployments
5. **Deployment Metrics** - Track deployment frequency and success rates
6. **Version Management** - Automated version bumping with conventional commits
