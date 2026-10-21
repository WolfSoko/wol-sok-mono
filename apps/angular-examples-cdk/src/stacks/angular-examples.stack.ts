import { SpaStack, SpaStackProps } from '@wolsok/spa-cdk-stack';
import { CacheControl, Source } from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';

export interface AngularExamplesStackProps extends SpaStackProps {
  /** Release version, served as version.json. */
  version: string;
}

export class AngularExamplesStack extends SpaStack {
  constructor(
    parent: Construct,
    name: string,
    props: AngularExamplesStackProps
  ) {
    super(parent, name, props);

    this.spa.addExtraAssets(
      [Source.jsonData('version.json', props.version)],
      CacheControl.noCache()
    );
  }
}
