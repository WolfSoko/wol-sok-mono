import { FirebaseOptions } from '@angular/fire/app';

export type Environment = {
  prod: boolean;
  dataAccessOptions: FirebaseOptions;
  /** GA4 measurement id; unset loads no Google tag. */
  googleAnalyticsMeasurementId?: string;
};
