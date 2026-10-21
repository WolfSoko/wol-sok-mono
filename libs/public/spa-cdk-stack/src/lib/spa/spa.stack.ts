import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { SpaConstruct, SpaProps } from './spa.construct';

export type SpaStackProps = StackProps & SpaProps;

/**
 * A stack that holds a single SpaConstruct with the same id as the stack.
 * Extend it and call `spa.addExtraAssets` to deploy further files.
 */
export class SpaStack extends Stack {
  public readonly spa: SpaConstruct;

  constructor(parent: Construct, name: string, props: SpaStackProps) {
    super(parent, name, props);

    this.spa = new SpaConstruct(this, name, {
      domainName: props.domainName,
      buildOutputPath: props.buildOutputPath,
      bucketRemovalPolicy: props.bucketRemovalPolicy,
      extraAllowedOrigins: props.extraAllowedOrigins,
      noCacheFiles: props.noCacheFiles,
    });
  }
}
