# Deployment Guide

This document describes the deployment workflows for the wol-sok-mono repository.

## Overview

The repository uses Nx for standardized deployments across different project types:

1. **NPM Packages** - Published to npm registry using Nx Release (e.g., `@wolsok/thanos`)
2. **Firebase Apps** - Deployed to Firebase Hosting (e.g., pacetrainer, rollapolla-analog)
3. **AWS CDK Stacks** - Deployed to AWS using CDK (e.g., angular-examples-cdk)

## Project Tags

Projects are tagged to control which deployment workflow they use:

- `tag:published` - NPM packages managed by Nx Release
- `tag:cdk` - AWS CDK infrastructure stacks
- No specific tag - Firebase or other non-CDK deployments

## NPM Package Deployment (Nx Release)

### Projects

- `ws-thanos` - Angular directive for Thanos snap effect
- `spa-cdk-stack` - CDK construct library for SPA hosting

### Overview of Nx Release

Nx Release is Nx's built-in solution for versioning and publishing packages. It handles:
- **Versioning** - Automatically determines version bumps based on conventional commits
- **Changelogs** - Generates CHANGELOG.md files for each project
- **Publishing** - Publishes packages to npm with provenance
- **GitHub Releases** - Creates releases on GitHub (configured in nx.json)

### Configuration

The release configuration is in `nx.json`:

```json
{
  "release": {
    "projects": ["tag:published"],
    "projectsRelationship": "independent",
    "changelog": {
      "projectChangelogs": true,
      "workspaceChangelog": {
        "createRelease": "github"
      }
    },
    "version": {
      "conventionalCommits": true
    }
  }
}
```

### Local Testing

Test publishing without actually publishing:

```bash
# Build the packages
nx build ws-thanos

# Test publish (dry-run)
nx release publish --dry-run
```

### Manual Publishing

To publish manually (requires npm authentication):

```bash
# Login to npm if not already authenticated
npm login

# Build packages
nx run-many -t build --projects='tag:published'

# Publish using Nx Release
nx release publish
```

### Full Release Process (Versioning + Publishing)

For a complete release including versioning and changelog:

```bash
# Dry run to preview changes
nx release --dry-run

# Actually perform the release
nx release

# Or for first release
nx release --first-release
```

### CI/CD Publishing

NPM packages are automatically published when:

1. A release tag is created (e.g., `v4.8.7`)
2. The deploy workflow detects affected projects with `tag:published`
3. `nx release publish` runs in the CI/CD pipeline

The workflow:
- Checks out the release tag
- Installs dependencies
- Sets up Node.js with npm registry authentication
- Runs `nx release publish` to publish affected packages
- Configures npm authentication by appending `NPM_TOKEN` to `.npmrc`
- Enables npm provenance for enhanced security
- Tags the deployment as `{version}-npm-deployed`

### Versioning Strategy

This repository uses **independent versioning** - each package maintains its own version number.

Version bumps are determined by conventional commit messages:
- `feat:` → minor version bump (0.x.0)
- `fix:` → patch version bump (0.0.x)
- `BREAKING CHANGE:` or `feat!:` → major version bump (x.0.0)

Example commit messages:
```bash
git commit -m "feat(ws-thanos): add new animation option"  # → 1.1.0
git commit -m "fix(ws-thanos): correct particle positioning"  # → 1.0.1
git commit -m "feat(ws-thanos)!: change API structure"  # → 2.0.0
```

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

### NPM Package (Using Nx Release)

For npm packages, you **don't need** to add a deploy target manually. Instead, just add the `published` tag to your project:

Add to `project.json`:

```json
{
  "name": "my-package",
  "tags": ["shared", "published"],
  "targets": {
    "build": {
      "executor": "@nx/js:tsc",
      "outputs": ["{options.outputPath}"],
      "options": {
        "outputPath": "dist/libs/my-package",
        "main": "libs/my-package/src/index.ts",
        "tsConfig": "libs/my-package/tsconfig.lib.json",
        "assets": ["libs/my-package/*.md"]
      }
    }
  }
}
```

The `published` tag tells Nx Release to include this project. Publishing is handled by:
1. `nx release publish` - Uses the built-in `nx-release-publish` target
2. Build output should be in `dist/libs/my-package` (or configured via `packageRoot`)

### Configuring Package Root (if needed)

If your build output is in a different location, configure it in `nx.json`:

```json
{
  "targetDefaults": {
    "nx-release-publish": {
      "options": {
        "packageRoot": "{projectRoot}/dist"
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
1. **For npm packages**: Does the project have the `published` tag? Run `nx show projects --projects='tag:published'`
2. **For apps**: Does the project have a `deploy` target in `project.json`?
3. Are there affected changes? Run `nx show projects --affected --projects='tag:published'` or `nx show projects --affected -t deploy`
4. Are the tags correct? Check project tags match the deployment type

### NPM Publish Fails

Check:
1. Is `NPM_TOKEN` secret configured in GitHub?
2. Does the package version in `package.json` already exist on npm?
3. Run locally with `nx release publish --dry-run` to test package structure
4. Is the build output in the correct location? Check `dist/libs/[package-name]`
5. Is Nx Release properly configured in `nx.json`?

Common fixes:
```bash
# Test publishing locally
nx build my-package
nx release publish --dry-run --verbose

# Check which projects will be published
nx show projects --projects='tag:published'

# Verify package.json exists in build output
ls -la dist/libs/my-package/package.json
```

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
