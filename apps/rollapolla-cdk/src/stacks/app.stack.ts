import { App, Stack, StackProps } from 'aws-cdk-lib';
import { SpaSite } from './static-site/spa.site';

export interface AppStackProps extends StackProps {
  buildOutputPath: string;
  domainName: string;
}

export class AppStack extends Stack {
  constructor(parent: App, name: string, props: AppStackProps) {
    super(parent, name, props);

    new SpaSite(this, name, {
      domainName: props.domainName,
      buildOutputPath: props.buildOutputPath,
    });
  }
}
