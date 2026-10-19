import { environmentBase } from './environment.base';
import { Environment } from './environment.type';

export const environment: Environment = {
  ...environmentBase,
  prod: false,
  // no analytics traffic from `nx serve` and the e2e tests
  googleAnalyticsMeasurementId: undefined,
};
