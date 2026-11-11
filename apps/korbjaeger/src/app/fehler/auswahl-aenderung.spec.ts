import { SelectionTooNewError } from '@wolsok/feat-korbjaeger-selection';
import { auswahlAenderung } from './auswahl-aenderung';

describe('auswahlAenderung', () => {
  it('says nothing while the change succeeds, and tells it succeeded', async () => {
    const aenderung = auswahlAenderung();

    await expect(aenderung.ausfuehren(() => Promise.resolve())).resolves.toBe(
      true
    );

    expect(aenderung.fehler()).toBeUndefined();
  });

  it('tells a change failed', async () => {
    const aenderung = auswahlAenderung();

    await expect(
      aenderung.ausfuehren(() => Promise.reject(new Error('offline')))
    ).resolves.toBe(false);
  });

  it('asks to try again where the change was not stored', async () => {
    const aenderung = auswahlAenderung();

    await aenderung.ausfuehren(() => Promise.reject(new Error('offline')));

    expect(aenderung.fehler()).toBe(
      'Das ließ sich nicht speichern. Bitte noch einmal versuchen.'
    );
  });

  it('asks to reload where a newer version stored Meine Teams', async () => {
    const aenderung = auswahlAenderung();

    await aenderung.ausfuehren(() =>
      Promise.reject(new SelectionTooNewError())
    );

    expect(aenderung.fehler()).toContain('Bitte die App neu laden.');
  });

  it('clears the last failure once a change succeeds', async () => {
    const aenderung = auswahlAenderung();
    await aenderung.ausfuehren(() => Promise.reject(new Error('offline')));

    await aenderung.ausfuehren(() => Promise.resolve());

    expect(aenderung.fehler()).toBeUndefined();
  });
});
