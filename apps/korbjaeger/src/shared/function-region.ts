/**
 * Where the app's Nitro function with the DBB proxy runs: `vite.config.ts`
 * deploys it there. Without imports, since a Vite config resolves no
 * `@wolsok/*` alias.
 */
export const FUNCTION_REGION = {
  id: 'europe-central2',
  place: 'Warschau',
} as const;
