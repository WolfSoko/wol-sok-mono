import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  NicknameDialogComponent,
  type NicknameQuestion,
} from './nickname-dialog.component';

async function render(question: NicknameQuestion) {
  const close = vi.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: question },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const fixture = TestBed.createComponent(NicknameDialogComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  const page = fixture.nativeElement as HTMLElement;
  const input = page.querySelector('input') as HTMLInputElement;
  const tap = async (text: string): Promise<void> => {
    input.value = text;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
  };
  const confirm = page.querySelector<HTMLButtonElement>(
    'button[type="submit"]'
  ) as HTMLButtonElement;
  return { page, input, tap, confirm, close };
}

function text(element: Element | null): string | undefined {
  return element?.textContent?.replace(/\s+/g, ' ').trim();
}

describe('NicknameDialogComponent', () => {
  it('closes with the Spitzname as typed', async () => {
    const { tap, confirm, close } = await render({
      name: 'Lumi Ahornwiese',
      action: 'mark',
    });

    await tap(' Lu ');
    confirm.click();

    expect(close).toHaveBeenCalledWith({ nickname: ' Lu ' });
  });

  it('starts with the Spitzname given so far', async () => {
    const { input } = await render({
      name: 'Lumi Ahornwiese',
      nickname: 'Lu',
      action: 'change',
    });

    expect(input.value).toBe('Lu');
  });

  it('counts the characters as a reader sees them, an emoji as one', async () => {
    const { page, tap } = await render({
      name: 'Lumi',
      action: 'mark',
    });

    await tap('🏀👨‍👧 Lu');

    expect(text(page.querySelector('[data-qa="nickname-counter"]'))).toBe(
      '5/30'
    );
  });

  it('takes no Spitzname over 30 characters, and says so', async () => {
    const { page, tap, confirm, close } = await render({
      name: 'Lumi',
      action: 'mark',
    });

    await tap('🏀'.repeat(30));
    expect(confirm.disabled).toBe(false);

    await tap('🏀'.repeat(31));
    expect(confirm.disabled).toBe(true);
    expect(text(page.querySelector('[data-qa="nickname-too-long"]'))).toBe(
      'Höchstens 30 Zeichen'
    );
    page.querySelector('form')?.requestSubmit();
    expect(close).not.toHaveBeenCalled();
  });
});
