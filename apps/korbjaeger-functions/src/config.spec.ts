import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REGION } from './config';

const workspaceText = (path: string) =>
  readFileSync(join(__dirname, '../../..', path), 'utf8');

describe('the functions config', () => {
  // an app imports no other app, so the region is read from the app's file
  it('runs the functions in the region of the Firestore database', () => {
    const regionen = workspaceText('apps/korbjaeger/src/shared/regionen.ts');
    const firestore = /firestore:\s*\{\s*id:\s*'([^']+)'/.exec(regionen);

    expect(firestore?.[1]).toBe(REGION);
  });
});
