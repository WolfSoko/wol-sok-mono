import { SelectionTooNewError } from '@wolsok/feat-korbjaeger-selection';
import { selectionChange } from './selection-change';

describe('selectionChange', () => {
  it('says nothing while the change succeeds, and tells it succeeded', async () => {
    const change = selectionChange();

    await expect(change.run(() => Promise.resolve())).resolves.toBe(true);

    expect(change.error()).toBeUndefined();
  });

  it('tells a change failed', async () => {
    const change = selectionChange();

    await expect(
      change.run(() => Promise.reject(new Error('offline')))
    ).resolves.toBe(false);
  });

  it('asks to try again where the change was not stored', async () => {
    const change = selectionChange();

    await change.run(() => Promise.reject(new Error('offline')));

    expect(change.error()).toBe(
      'Das ließ sich nicht speichern. Bitte noch einmal versuchen.'
    );
  });

  it('asks to reload where a newer version stored Meine Teams', async () => {
    const change = selectionChange();

    await change.run(() => Promise.reject(new SelectionTooNewError()));

    expect(change.error()).toContain('Bitte die App neu laden.');
  });

  it('clears the last failure once a change succeeds', async () => {
    const change = selectionChange();
    await change.run(() => Promise.reject(new Error('offline')));

    await change.run(() => Promise.resolve());

    expect(change.error()).toBeUndefined();
  });
});
