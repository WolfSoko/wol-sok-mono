import { parseCleanupArgs, reportText, USAGE } from './cleanup-cli';

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

  describe('refuses to run', () => {
    const before = process.env['GCLOUD_PROJECT'];
    beforeEach(() => {
      // an environment project is no fallback
      process.env['GCLOUD_PROJECT'] = 'korbjaeger';
    });
    afterEach(() => {
      if (before === undefined) {
        delete process.env['GCLOUD_PROJECT'];
      } else {
        process.env['GCLOUD_PROJECT'] = before;
      }
    });

    it.each([
      ['without --project', []],
      ['with --delete alone', ['--delete']],
      ['with an empty --project', ['--project=  ']],
    ])('%s', (_, args) => {
      expect(() => parseCleanupArgs(args)).toThrow('--project is required');
    });

    it.each([
      ['an unknown option', ['--project=korbjaeger', '--force']],
      ['a positional argument', ['--project=korbjaeger', 'korbjaeger']],
    ])('with %s', (_, args) => {
      expect(() => parseCleanupArgs(args)).toThrow(USAGE);
    });
  });
});

describe('reportText', () => {
  it('names the project, the mode and the counts', () => {
    const report = {
      documentsRead: { selections: 3, auswahl: 2 },
      orphansFound: 2,
      orphansDeleted: 0,
    };

    expect(reportText('demo-korbjaeger', report, false)).toBe(
      [
        'Orphan cleanup on demo-korbjaeger (dry run)',
        '  selections: 3 documents read',
        '  auswahl: 2 documents read',
        '  orphaned accounts found: 2',
        '  orphaned accounts deleted: 0',
      ].join('\n')
    );
  });
});
