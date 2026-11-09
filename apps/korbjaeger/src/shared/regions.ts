import { FIRESTORE_REGION } from '@wolsok/feat-shared-korbjaeger-account';
import { FUNCTION_REGION } from './function-region';

/**
 * Where Google runs the app's parts: the Nitro function with the DBB proxy
 * and the Firestore database, whose location was fixed when it was created
 * (ADR 0019). The privacy policy names both; a function that reads or
 * writes Firestore belongs in its region.
 */
export const REGIONS = {
  function: FUNCTION_REGION,
  firestore: FIRESTORE_REGION,
} as const;
