import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  InstallationsHinweis,
  type InstallationsAngebot,
} from './installations-hinweis';
import { InstallationsHinweisComponent } from './installations-hinweis.component';

interface Aufbau {
  readonly seite: HTMLElement;
  readonly installieren: ReturnType<typeof vi.fn<() => Promise<void>>>;
  /** How many shown hints the service was told of. */
  angezeigt(): number;
  entfernen(): void;
  /** Clicks the button labelled `text` and waits for the page. */
  klicken(text: string): Promise<void>;
}

async function render(angebot: InstallationsAngebot): Promise<Aufbau> {
  const stand = signal(angebot);
  let angezeigt = 0;
  const installieren = vi.fn<() => Promise<void>>(() => Promise.resolve());
  const hinweis: Pick<
    InstallationsHinweis,
    'angebot' | 'installieren' | 'ablehnen' | 'anzeigen'
  > = {
    angebot: stand,
    installieren,
    ablehnen: () => stand.set('keins'),
    anzeigen: () => {
      angezeigt++;
      return () => angezeigt--;
    },
  };
  TestBed.configureTestingModule({
    providers: [{ provide: InstallationsHinweis, useValue: hinweis }],
  });
  const fixture = TestBed.createComponent(InstallationsHinweisComponent);
  await fixture.whenStable();
  const seite = fixture.nativeElement as HTMLElement;
  return {
    seite,
    installieren,
    angezeigt: () => angezeigt,
    entfernen: () => fixture.destroy(),
    klicken: async (text) => {
      const knopf = [...seite.querySelectorAll('button')].find(
        (element) => element.textContent?.trim() === text
      );
      if (knopf === undefined) {
        throw new Error(`no button ${text}`);
      }
      knopf.click();
      await fixture.whenStable();
    },
  };
}

function hinweisText(seite: HTMLElement): string | undefined {
  return seite
    .querySelector('[data-qa="installations-hinweis"]')
    ?.textContent?.replace(/\s+/g, ' ');
}

describe('InstallationsHinweisComponent', () => {
  it("offers the browser's install dialog", async () => {
    const { seite, installieren, klicken } = await render('installieren');
    expect(hinweisText(seite)).toContain('Korbjäger als App');

    await klicken('Installieren');

    expect(installieren).toHaveBeenCalledTimes(1);
  });

  it("explains the share menu on iOS, in no browser's name, with no install button", async () => {
    const { seite } = await render('ios');

    expect(hinweisText(seite)).toContain('im Teilen-Menü');
    expect(hinweisText(seite)).not.toContain('Safari');
    expect(hinweisText(seite)).toContain('„Zum Home-Bildschirm“');
    expect(seite.textContent).not.toContain('Installieren');
  });

  it('shows nothing where nothing is offered', async () => {
    const { seite } = await render('keins');

    expect(hinweisText(seite)).toBeUndefined();
  });

  it('tells the service it shows the hint, until it is gone', async () => {
    const { angezeigt, entfernen } = await render('keins');
    expect(angezeigt()).toBe(1);

    entfernen();

    expect(angezeigt()).toBe(0);
  });

  it('goes once dismissed', async () => {
    const { seite, klicken } = await render('ios');

    await klicken('Ausblenden');

    expect(hinweisText(seite)).toBeUndefined();
  });
});
