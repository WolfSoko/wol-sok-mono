import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { InstallHint, type InstallOffer } from './install-hint';
import { InstallHintComponent } from './install-hint.component';

interface Setup {
  readonly page: HTMLElement;
  readonly install: ReturnType<typeof vi.fn<() => Promise<void>>>;
  /** How many shown hints the service was told of. */
  shown(): number;
  entfernen(): void;
  /** Clicks the button labelled `text` and waits for the page. */
  click(text: string): Promise<void>;
}

/** What stays on the page once the hint goes, as the home page's heading. */
const AFTER = Object.assign(document.createElement('h1'), {
  tabIndex: -1,
  textContent: 'Korbjäger',
});
document.body.append(AFTER);

async function render(offer: InstallOffer): Promise<Setup> {
  const state = signal(offer);
  let shown = 0;
  const install = vi.fn<() => Promise<void>>(() => Promise.resolve());
  const hint: Pick<InstallHint, 'offer' | 'install' | 'dismiss' | 'show'> = {
    offer: state,
    install,
    dismiss: () => state.set('none'),
    show: () => {
      shown++;
      return () => shown--;
    },
  };
  TestBed.configureTestingModule({
    providers: [{ provide: InstallHint, useValue: hint }],
  });
  const fixture = TestBed.createComponent(InstallHintComponent);
  fixture.componentRef.setInput('focusAfter', AFTER);
  await fixture.whenStable();
  const page = fixture.nativeElement as HTMLElement;
  return {
    page,
    install,
    shown: () => shown,
    entfernen: () => fixture.destroy(),
    click: async (text) => {
      const button = [...page.querySelectorAll('button')].find(
        (element) => element.textContent?.trim() === text
      );
      if (button === undefined) {
        throw new Error(`no button ${text}`);
      }
      button.click();
      await fixture.whenStable();
    },
  };
}

function hintText(page: HTMLElement): string | undefined {
  return page
    .querySelector('[data-qa="install-hint"]')
    ?.textContent?.replace(/\s+/g, ' ');
}

describe('InstallHintComponent', () => {
  it("offers the browser's install dialog", async () => {
    const { page, install, click } = await render('install');
    expect(hintText(page)).toContain('Korbjäger als App');

    await click('Installieren');

    expect(install).toHaveBeenCalledTimes(1);
    // the hint goes with the browser's dialog open
    expect(document.activeElement).toBe(AFTER);
  });

  it("explains the share menu on iOS, in no browser's name, with no install button", async () => {
    const { page } = await render('ios');

    expect(hintText(page)).toContain('im Teilen-Menü');
    expect(hintText(page)).not.toContain('Safari');
    expect(hintText(page)).toContain('„Zum Home-Bildschirm“');
    expect(page.textContent).not.toContain('Installieren');
  });

  it('shows nothing where nothing is offered', async () => {
    const { page } = await render('none');

    expect(hintText(page)).toBeUndefined();
  });

  it('tells the service it shows the hint, until it is gone', async () => {
    const { shown, entfernen } = await render('none');
    expect(shown()).toBe(1);

    entfernen();

    expect(shown()).toBe(0);
  });

  it('goes once dismissed, focus on what stays', async () => {
    const { page, click } = await render('ios');

    await click('Ausblenden');

    expect(hintText(page)).toBeUndefined();
    expect(document.activeElement).toBe(AFTER);
  });
});
