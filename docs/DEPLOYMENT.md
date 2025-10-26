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
- Sets up Node.js with npm registry authentication (via `setup-node` action)
- Runs `nx release publish` to publish affected packages
- Uses `NODE_AUTH_TOKEN` environment variable for authentication
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
3. Are there affected changes? Run `nx show projects --affected --projects='tag:published'`
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
   This guide covers deployment processes for applications in the wol-sok-mono repository.

## Table of Contents

- [Deployment Overview](#deployment-overview)
- [Firebase Deployment](#firebase-deployment)
- [AWS CDK Deployment](#aws-cdk-deployment)
- [GitHub Pages Deployment](#github-pages-deployment)
- [CI/CD Pipeline](#cicd-pipeline)
- [Environment Configuration](#environment-configuration)
- [Rollback Procedures](#rollback-procedures)

## Deployment Overview

The monorepo contains multiple applications with different deployment targets:

| Application             | Deployment Target   | Method       | Live URL                          |
| ----------------------- | ------------------- | ------------ | --------------------------------- |
| angular-examples        | GitHub Pages / S3   | Manual / CI  | https://angularexamples.wolsok.de |
| pacetrainer             | Firebase Hosting    | Firebase CLI | TBD                               |
| rollapolla-analog       | Firebase Hosting    | Firebase CLI | TBD                               |
| fourier-analysis-remote | AWS CloudFront + S3 | AWS CDK      | TBD                               |
| bacteria-game-remote    | AWS CloudFront + S3 | AWS CDK      | TBD                               |
| shader-examples-remote  | AWS CloudFront + S3 | AWS CDK      | TBD                               |

## Firebase Deployment

### Prerequisites

1. **Firebase CLI**:

   ```bash
   npm install -g firebase-tools
   ```

2. **Firebase Login**:

   ```bash
   firebase login
   ```

3. **Project Configuration**:
   Each Firebase project has its own config file:
   - `firebase.pacetrainer.json`
   - `firebase.rollapolla-analog.json`

### Deploying Pacetrainer

#### 1. Build the Application

```bash
npx nx build pacetrainer --configuration production
```

The build output will be in `dist/apps/pacetrainer`.

#### 2. Deploy to Firebase

```bash
firebase deploy --config firebase.pacetrainer.json
```

Or use the Nx target:

```bash
npx nx run pacetrainer:deploy
```

#### 3. Verify Deployment

Check the deployment URL provided in the Firebase console output.

### Deploying Rollapolla-Analog

#### 1. Build the Application

```bash
npx nx build rollapolla-analog --configuration production
```

#### 2. Deploy to Firebase

```bash
firebase deploy --config firebase.rollapolla-analog.json
```

Or use the Nx target:

```bash
npx nx run rollapolla-analog:deploy
```

### Firebase Configuration

#### Environment Setup

Each app has environment files in `apps/<app>/src/environments/`:

- `environment.ts` - Development
- `environment.prod.ts` - Production

Example:

```typescript
export const environment = {
  production: true,
  firebase: {
    apiKey: 'YOUR_API_KEY',
    authDomain: 'your-project.firebaseapp.com',
    projectId: 'your-project',
    storageBucket: 'your-project.appspot.com',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId: 'YOUR_APP_ID',
  },
};
```

⚠️ **Never commit API keys to the repository**. Use environment variables in CI/CD.

#### Firebase Hosting Configuration

Example `firebase.pacetrainer.json`:

```json
{
  "hosting": {
    "public": "dist/apps/pacetrainer",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ],
    "headers": [
      {
        "source": "**/*.@(js|css|woff2)",
        "headers": [
          {
            "key": "Cache-Control",
            "value": "max-age=31536000"
          }
        ]
      }
    ]
  }
}
```

### Firebase Functions (if applicable)

If your project uses Firebase Functions:

```bash
# Deploy functions only
firebase deploy --only functions --config firebase.pacetrainer.json

# Deploy specific function
firebase deploy --only functions:myFunction --config firebase.pacetrainer.json
```

## AWS CDK Deployment

Remote applications use AWS CDK for infrastructure as code.

### Prerequisites

1. **AWS CLI**:

   ```bash
   # Install AWS CLI
   # https://aws.amazon.com/cli/

   # Configure credentials
   aws configure
   ```

2. **AWS CDK**:

   ```bash
   npm install -g aws-cdk
   ```

3. **Bootstrap CDK** (first time only):
   ```bash
   cdk bootstrap aws://ACCOUNT-ID/REGION
   ```

### CDK Application Structure

Each remote application has a corresponding CDK app:

```
apps/
├── fourier-analysis-remote/        # Application code
└── fourier-analysis-remote-cdk/    # Infrastructure code
    ├── src/
    │   └── main.ts                 # CDK stack definition
    └── cdk.json                    # CDK configuration
```

### Deploying Remote Applications

#### 1. Build the Application

```bash
npx nx build fourier-analysis-remote --configuration production
```

#### 2. Deploy Infrastructure

```bash
npx nx deploy fourier-analysis-remote-cdk
```

This will:

- Create/update CloudFront distribution
- Create/update S3 bucket
- Upload application files to S3
- Invalidate CloudFront cache

#### 3. View Deployment Output

The deployment will output:

- CloudFront distribution URL
- S3 bucket name
- CloudFront distribution ID

### CDK Stack Components

Typical CDK stack includes:

```typescript
// apps/fourier-analysis-remote-cdk/src/main.ts
import * as cdk from 'aws-cdk-lib';
import { SpaCdkStack } from '@wolsok/spa-cdk-stack';

const app = new cdk.App();

new SpaCdkStack(app, 'FourierAnalysisStack', {
  appName: 'fourier-analysis',
  domainName: 'fourier.example.com', // Optional custom domain
  certificateArn: 'arn:aws:acm:...', // Optional SSL certificate
});
```

### Custom Domain Setup

To use a custom domain:

1. **Create SSL Certificate** in ACM (us-east-1)
2. **Update CDK stack** with domain and certificate
3. **Deploy stack**
4. **Update DNS** with CloudFront distribution URL

## GitHub Pages Deployment

### Manual Deployment

For angular-examples:

#### 1. Build Application

```bash
npx nx build angular-examples --configuration production
```

#### 2. Deploy to GitHub Pages

Using the provided script:

```bash
npm run deploy-manually
```

This script:

- Builds the application
- Syncs to S3 (if configured)
- Can be configured for GitHub Pages

### Automatic Deployment via CI/CD

GitHub Actions automatically deploys on push to `main`:

```yaml
# .github/workflows/deploy.yml
- name: Build
  run: npx nx build angular-examples --configuration production

- name: Deploy to GitHub Pages
  uses: peaceiris/actions-gh-pages@v3
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
    publish_dir: ./dist/apps/angular-examples
```

## CI/CD Pipeline

### GitHub Actions Workflow

The repository uses GitHub Actions for CI/CD.

#### Main Workflow (`.github/workflows/ci.yml`)

Runs on every push and pull request:

1. **Checkout code**
2. **Setup Node.js**
3. **Install dependencies**
4. **Lint** affected projects
5. **Test** affected projects
6. **Build** affected projects
7. **Upload coverage** to Codecov
8. **Deploy** (on main branch only)

#### Nx Cloud Integration

The repository uses Nx Cloud for:

- **Distributed task execution**: Parallel builds across machines
- **Remote caching**: Share build cache across team
- **CI optimization**: Only test/build affected projects

Access token is in `nx.json`:

```json
{
  "nxCloudAccessToken": "READ_ONLY_TOKEN"
}
```

### Environment Variables in CI

Set these secrets in GitHub repository settings:

- `FIREBASE_TOKEN`: Firebase CI token
- `AWS_ACCESS_KEY_ID`: AWS credentials
- `AWS_SECRET_ACCESS_KEY`: AWS credentials
- `CODECOV_TOKEN`: Codecov upload token

Get Firebase token:

```bash
firebase login:ci
```

## Environment Configuration

### Environment Files

Each application has environment configuration:

```
apps/pacetrainer/src/environments/
├── environment.ts           # Development
└── environment.prod.ts      # Production
```

### Build Configurations

Defined in `project.json`:

```json
{
  "targets": {
    "build": {
      "configurations": {
        "production": {
          "fileReplacements": [
            {
              "replace": "src/environments/environment.ts",
              "with": "src/environments/environment.prod.ts"
            }
          ],
          "optimization": true,
          "outputHashing": "all",
          "sourceMap": false,
          "namedChunks": false,
          "extractLicenses": true,
          "budgets": [...]
        }
      }
    }
  }
}
```

### Environment Variables

Use environment variables for sensitive configuration:

```bash
# .env (not committed)
FIREBASE_API_KEY=your_api_key
AWS_REGION=us-east-1
```

Access in code:

```typescript
const apiKey = process.env['FIREBASE_API_KEY'];
```

⚠️ **Never commit `.env` files**. Add to `.gitignore`.

## Rollback Procedures

### Firebase Rollback

#### Option 1: Redeploy Previous Version

```bash
# Get previous build from git
git checkout <previous-commit>

# Build and deploy
npx nx build pacetrainer --configuration production
firebase deploy --config firebase.pacetrainer.json
```

#### Option 2: Firebase Hosting Rollback

```bash
# View deployment history
firebase hosting:releases --config firebase.pacetrainer.json

# Rollback to specific release
firebase hosting:rollback <release-id> --config firebase.pacetrainer.json
```

### AWS CDK Rollback

#### Option 1: Redeploy Previous Version

```bash
# Checkout previous version
git checkout <previous-commit>

# Build and deploy
npx nx build fourier-analysis-remote --configuration production
npx nx deploy fourier-analysis-remote-cdk
```

#### Option 2: Use CloudFormation Rollback

In AWS Console:

1. Go to CloudFormation
2. Find your stack
3. Choose "Stack actions" → "Roll back"

### GitHub Pages Rollback

Redeploy from previous commit:

```bash
git checkout <previous-commit>
npm run deploy-manually
```

## Deployment Checklist

Before deploying to production:

- [ ] All tests pass locally
- [ ] All linting passes
- [ ] Code reviewed and approved
- [ ] Environment variables configured
- [ ] Build succeeds in production mode
- [ ] Tested in staging environment (if available)
- [ ] Database migrations completed (if applicable)
- [ ] Changelog updated
- [ ] Team notified of deployment

After deployment:

- [ ] Verify application loads
- [ ] Check console for errors
- [ ] Test critical user flows
- [ ] Monitor error tracking (Sentry, if configured)
- [ ] Check analytics (if configured)
- [ ] Monitor performance

## Troubleshooting

### Firebase Deploy Fails

**Issue**: Authentication error

```bash
# Re-login
firebase login --reauth

# Get new CI token
firebase login:ci
```

**Issue**: Build not found

```bash
# Ensure build completed
npx nx build <project> --configuration production

# Check build output directory
ls dist/apps/<project>
```

### CDK Deploy Fails

**Issue**: No credentials

```bash
# Configure AWS CLI
aws configure

# Verify credentials
aws sts get-caller-identity
```

**Issue**: Stack already exists

```bash
# Update existing stack (don't create new)
npx nx deploy <cdk-project> --force
```

### Build Failures

**Issue**: Out of memory

```bash
# Increase Node.js memory
export NODE_OPTIONS="--max_old_space_size=8192"
npx nx build <project> --configuration production
```

**Issue**: Missing dependencies

```bash
# Clean install
rm -rf node_modules package-lock.json
npm ci
```

## Monitoring and Logs

### Firebase Logs

View hosting logs:

```bash
firebase hosting:logs --config firebase.pacetrainer.json
```

### AWS CloudWatch Logs

View CloudFront logs in AWS Console:

1. CloudWatch → Log groups
2. Find your distribution logs
3. View recent entries

### Application Monitoring

Consider integrating:

- **Sentry**: Error tracking
- **Google Analytics**: User analytics
- **Firebase Analytics**: User behavior
- **CloudWatch**: AWS metrics

## Security Considerations

1. **Never commit secrets**: Use environment variables
2. **Use HTTPS**: Always serve over HTTPS
3. **Set security headers**: CSP, HSTS, etc.
4. **Limit CORS**: Restrict origins
5. **Regular updates**: Keep dependencies updated
6. **Monitor vulnerabilities**: Use Dependabot/Renovate

## Additional Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [GitHub Actions Documentation](https://docs.github.com/actions)
- [Nx Cloud Documentation](https://nx.dev/ci/intro/ci-with-nx)

## Getting Help

For deployment issues:

- Check error messages carefully
- Review logs (Firebase, CloudWatch, GitHub Actions)
- Search existing issues
- Create a new issue with details
- Contact repository maintainers

Happy deploying! 🚀
