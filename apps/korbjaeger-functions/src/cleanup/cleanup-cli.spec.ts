import {
  cleanupTargets,
  errorText,
  parseCleanupArgs,
  reportText,
  USAGE,
} from './cleanup-cli';

describe('parseCleanupArgs', () => {
  it('runs a dry run unless --delete is given', () => {
    expect(parseCleanupArgs(['--project=korbjaeger'])).toEqual({
      project: 'korbjaeger',
      deleteOrphans: false,
    });
  });

  it('deletes with --delete', () => {
    expect(parseCleanupArgs(['--project', 'korbjaeger', '--delete'])).toEqual({
      project: 'korbjaeger',
      deleteOrphans: true,
    });
  });

  it.each([
    ['without --project', []],
    ['with --delete alone', ['--delete']],
    ['with an empty --project', ['--project=  ']],
  ])('refuses to run %s', (_, args) => {
    expect(() => parseCleanupArgs(args)).toThrow('--project is required');
  });

  it.each([
    ['an unknown option', ['--project=korbjaeger', '--force']],
    ['a positional argument', ['--project=korbjaeger', 'korbjaeger']],
  ])('refuses to run with %s', (_, args) => {
    expect(() => parseCleanupArgs(args)).toThrow(USAGE);
  });
});

describe('cleanupTargets', () => {
  it('names production where no emulator is set', () => {
    expect(cleanupTargets({})).toEqual({
      firestore: 'production',
      auth: 'production',
    });
  });

  it('names both emulators', () => {
    expect(
      cleanupTargets({
        FIRESTORE_EMULATOR_HOST: '127.0.0.1:8393',
        FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9393',
      })
    ).toEqual({
      firestore: 'emulator 127.0.0.1:8393',
      auth: 'emulator 127.0.0.1:9393',
    });
  });

  it.each([
    ['the Auth emulator alone', { FIREBASE_AUTH_EMULATOR_HOST: 'h:1' }],
    ['the Firestore emulator alone', { FIRESTORE_EMULATOR_HOST: 'h:1' }],
  ])('refuses %s', (_, env) => {
    expect(() => cleanupTargets(env)).toThrow('both or neither');
  });
});

describe('reportText', () => {
  it('names the project, the mode, the targets and the counts', () => {
    const report = {
      documentsListed: { selections: 3, auswahl: 2 },
      orphansFound: 2,
      orphansDeleted: 1,
    };

    expect(
      reportText(
        { project: 'korbjaeger', deleteOrphans: true },
        { firestore: 'production', auth: 'production' },
        report
      )
    ).toBe(
      [
        'Orphan cleanup on korbjaeger (delete)',
        '  Firestore: production, Auth: production',
        '  selections: 3 documents listed',
        '  auswahl: 2 documents listed',
        '  orphaned accounts found: 2',
        '  orphaned accounts deleted: 1',
        '  orphaned accounts failed: 1',
      ].join('\n')
    );
  });
});

describe('errorText', () => {
  it("prints an Error's message", () => {
    expect(errorText(new Error('no credentials'))).toBe('no credentials');
  });

  it('prints a fixed text for anything else, never the value', () => {
    expect(errorText({ uid: 'some-parent' })).toBe('The cleanup failed.');
    expect(errorText('some-parent')).not.toContain('some-parent');
  });
});
