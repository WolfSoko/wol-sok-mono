import { FIRESTORE_REGION } from '@wolsok/feat-shared-korbjaeger-account';

/**
 * Where Korbjäger's functions run: next to the Firestore database they
 * write. The app's Nitro function runs elsewhere, in `REGIONS.function`.
 */
export const REGION = FIRESTORE_REGION.id;
