import { FirebaseOptions } from '@angular/fire/app';

export type Environment = {
  prod: boolean;
  dataAccessOptions: FirebaseOptions;
};
