import { dataAccessOptions } from './data-access.options';
import { Environment } from './environment.type';

export const environmentBase: Environment = {
  prod: true,
  dataAccessOptions: dataAccessOptions,
};
