/**
 * Where Google runs the app's parts: the Nitro function with the DBB proxy
 * (`vite.config.ts` deploys it there) and the Firestore database, whose
 * location was fixed when it was created (ADR 0019). The privacy policy
 * names both; a function that reads or writes Firestore belongs in its
 * region.
 */
export const REGIONEN = {
  funktion: { id: 'europe-central2', ort: 'Warschau' },
  firestore: { id: 'europe-west3', ort: 'Frankfurt am Main' },
} as const;
