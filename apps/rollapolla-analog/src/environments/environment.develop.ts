import { environmentBase } from './environment.base';
import { Environment } from './environment.type';

export const environment: Environment = {
  ...environmentBase,
  prod: false,
};
