# Deployment Guide

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

| Application | Deployment Target | Method | Live URL |
|------------|------------------|--------|----------|
| angular-examples | GitHub Pages / S3 | Manual / CI | https://angularexamples.wolsok.de |
| pacetrainer | Firebase Hosting | Firebase CLI | TBD |
| rollapolla-analog | Firebase Hosting | Firebase CLI | TBD |
| fourier-analysis-remote | AWS CloudFront + S3 | AWS CDK | TBD |
| bacteria-game-remote | AWS CloudFront + S3 | AWS CDK | TBD |
| shader-examples-remote | AWS CloudFront + S3 | AWS CDK | TBD |

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
    appId: 'YOUR_APP_ID'
  }
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
