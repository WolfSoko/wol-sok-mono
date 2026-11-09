import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  SpitznameDialogComponent,
  type SpitznameFrage,
} from './spitzname-dialog.component';

async function render(frage: SpitznameFrage) {
  const schliessen = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: frage },
      { provide: MatDialogRef, useValue: { close: schliessen } },
    ],
  });
  const fixture = TestBed.createComponent(SpitznameDialogComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  const seite = fixture.nativeElement as HTMLElement;
  const eingabe = seite.querySelector('input') as HTMLInputElement;
  const tippen = async (text: string): Promise<void> => {
    eingabe.value = text;
    eingabe.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const bestaetigen = seite.querySelector<HTMLButtonElement>(
    'button[type="submit"]'
  ) as HTMLButtonElement;
  return { seite, eingabe, tippen, bestaetigen, schliessen };
}

function text(element: Element | null): string | undefined {
  return element?.textContent?.replace(/\s+/g, ' ').trim();
}

describe('SpitznameDialogComponent', () => {
  it('closes with the Spitzname as typed', async () => {
    const { tippen, bestaetigen, schliessen } = await render({
      name: 'Lumi Ahornwiese',
      aktion: 'markieren',
    });

    await tippen(' Lu ');
    bestaetigen.click();

    expect(schliessen).toHaveBeenCalledWith({ spitzname: ' Lu ' });
  });

  it('starts with the Spitzname given so far', async () => {
    const { eingabe } = await render({
      name: 'Lumi Ahornwiese',
      spitzname: 'Lu',
      aktion: 'aendern',
    });

    expect(eingabe.value).toBe('Lu');
  });

  it('counts the characters as a reader sees them, an emoji as one', async () => {
    const { seite, tippen } = await render({
      name: 'Lumi',
      aktion: 'markieren',
    });

    await tippen('🏀👨‍👧 Lu');

    expect(text(seite.querySelector('[data-qa="spitzname-zaehler"]'))).toBe(
      '5/30'
    );
  });

  it('takes no Spitzname over 30 characters, and says so', async () => {
    const { seite, tippen, bestaetigen, schliessen } = await render({
      name: 'Lumi',
      aktion: 'markieren',
    });

    await tippen('🏀'.repeat(30));
    expect(bestaetigen.disabled).toBe(false);

    await tippen('🏀'.repeat(31));
    expect(bestaetigen.disabled).toBe(true);
    expect(text(seite.querySelector('[data-qa="spitzname-zu-lang"]'))).toBe(
      'Höchstens 30 Zeichen'
    );
    seite.querySelector('form')?.requestSubmit();
    expect(schliessen).not.toHaveBeenCalled();
  });
});
