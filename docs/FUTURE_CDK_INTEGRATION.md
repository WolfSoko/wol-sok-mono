# Future: Standardized CDK Deployment Integration

This document outlines the plan for bringing all CDK and AWS deployments under a unified Nx deploy workflow.

## Current State

### CDK Stacks (Already Integrated)
- `angular-examples-cdk`
- `fourier-analysis-remote-cdk`
- `shader-examples-remote-cdk`
- `bacteria-game-remote-cdk`

These already use:
- `@wolsok/nx-aws-cdk-v2:deploy` executor
- `tag:cdk` for filtering
- Deploy workflow integration

### Other AWS Resources (Not Yet Integrated)

May include:
- Lambda functions
- S3 buckets
- CloudFront distributions
- API Gateways
- DynamoDB tables
- Other AWS services

## Proposed Integration Steps

### 1. Inventory Existing Deployments

Identify all current deployment methods:
- Manual AWS CLI scripts
- Custom deployment scripts
- GitHub Actions without Nx integration
- Other deployment tools

### 2. Standardize CDK Patterns

Create reusable CDK constructs:
- Standard SPA hosting pattern (already exists as `spa-cdk-stack`)
- Lambda function deployment pattern
- API deployment pattern
- Database deployment pattern

### 3. Create Nx Targets

For each deployment, create standardized targets:

```json
{
  "targets": {
    "deploy": {
      "executor": "@wolsok/nx-aws-cdk-v2:deploy",
      "options": {
        "output": "{workspaceRoot}/dist/{projectRoot}",
        "require-approval": "never"
      }
    },
    "diff": {
      "executor": "@wolsok/nx-aws-cdk-v2:diff",
      "options": {}
    },
    "synth": {
      "executor": "@wolsok/nx-aws-cdk-v2:synth",
      "options": {
        "output": "{workspaceRoot}/dist/{projectRoot}/cdk.out"
      }
    },
    "destroy": {
      "executor": "@wolsok/nx-aws-cdk-v2:destroy",
      "options": {}
    }
  }
}
```

### 4. Environment Configuration

Standardize environment handling:

```typescript
// tools/cdk/environment-config.ts
export const getEnvironmentConfig = (stage: 'dev' | 'staging' | 'prod') => {
  return {
    account: process.env[`AWS_ACCOUNT_${stage.toUpperCase()}`],
    region: process.env[`AWS_REGION_${stage.toUpperCase()}`] || 'us-east-1',
    // ... other config
  };
};
```

### 5. Deployment Dependencies

Configure proper deployment order:

```json
{
  "name": "app-cdk",
  "implicitDependencies": ["app", "shared-infra-cdk"]
}
```

### 6. Custom Executors (if needed)

Create custom executors for non-CDK AWS deployments:

```typescript
// tools/executors/aws-lambda-deploy/executor.ts
export default async function runExecutor(
  options: LambdaDeployExecutorSchema,
  context: ExecutorContext
): Promise<{ success: boolean }> {
  // Build Lambda function
  // Package as ZIP
  // Upload to S3
  // Update Lambda function
  return { success: true };
}
```

### 7. Testing Strategy

Add deployment testing:
- Dry-run deployments in PR checks
- Smoke tests after deployment
- Integration tests for deployed services
- Cost estimation before deployment

### 8. Deployment Monitoring

Add monitoring and alerting:
- Deployment success/failure notifications
- CloudWatch dashboard creation
- Error tracking integration
- Performance monitoring

## Benefits

1. **Consistency** - All deployments follow same patterns
2. **Visibility** - `nx affected --target=deploy` shows what will deploy
3. **Caching** - Nx caching reduces redundant deployments
4. **Dependencies** - Proper ordering of infrastructure and app deployments
5. **Testing** - Integrated testing before and after deployment
6. **Rollback** - Easier to implement rollback strategies
7. **Documentation** - Self-documenting through project.json configuration

## Migration Path

### Phase 1: Assess (1-2 weeks)
- [ ] Inventory all current AWS resources
- [ ] Document current deployment processes
- [ ] Identify gaps in CDK coverage
- [ ] Create migration plan

### Phase 2: Standardize (2-3 weeks)
- [ ] Create missing CDK constructs
- [ ] Update existing CDK stacks to follow patterns
- [ ] Add deploy targets to all CDK projects
- [ ] Test deployments in dev environment

### Phase 3: Integrate (2-3 weeks)
- [ ] Update GitHub workflows
- [ ] Configure environment-specific deployments
- [ ] Add deployment testing
- [ ] Document new processes

### Phase 4: Migrate (3-4 weeks)
- [ ] Migrate non-CDK deployments to CDK
- [ ] Update CI/CD pipelines
- [ ] Train team on new processes
- [ ] Monitor and adjust

### Phase 5: Optimize (Ongoing)
- [ ] Add deployment metrics
- [ ] Implement cost optimization
- [ ] Add automated rollback
- [ ] Continuous improvement

## Example: Lambda Function Deployment

Before (manual script):
```bash
#!/bin/bash
npm run build
zip -r function.zip dist/
aws lambda update-function-code --function-name my-function --zip-file fileb://function.zip
```

After (Nx + CDK):
```typescript
// apps/my-lambda-cdk/src/main.ts
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cdk from 'aws-cdk-lib';

export class MyLambdaStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    new lambda.Function(this, 'MyFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('../../dist/apps/my-lambda'),
    });
  }
}
```

Deploy with:
```bash
nx deploy my-lambda-cdk
```

## Questions to Answer

1. **What deployment methods are currently used outside of Nx?**
   - Manual AWS CLI commands?
   - Custom scripts in package.json?
   - GitHub Actions without Nx?

2. **Which resources should be managed with CDK?**
   - Should all AWS resources be in CDK?
   - Are there cases where other tools are better?

3. **How should environments be managed?**
   - Separate AWS accounts per environment?
   - Same account, different regions?
   - How to handle environment-specific config?

4. **What about non-AWS deployments?**
   - Docker containers to other registries?
   - Other cloud providers?
   - On-premise deployments?

5. **How to handle breaking changes?**
   - Blue-green deployments?
   - Canary releases?
   - Feature flags?

## Resources

- [Nx AWS CDK Plugin](https://www.npmjs.com/package/@wolsok/nx-aws-cdk-v2)
- [AWS CDK Best Practices](https://docs.aws.amazon.com/cdk/v2/guide/best-practices.html)
- [Nx Custom Executors](https://nx.dev/extending-nx/recipes/local-executors)
- [CDK Patterns](https://cdkpatterns.com/)

## Next Steps

1. Review this document with the team
2. Prioritize which deployments to migrate first
3. Create proof of concept for one deployment type
4. Iterate and expand to other deployments
