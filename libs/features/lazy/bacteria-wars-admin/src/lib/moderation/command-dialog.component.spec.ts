import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import {
  CommandDialogComponent,
  type CommandDialogData,
} from './command-dialog.component';

async function render(data: CommandDialogData) {
  const close = jest.fn();
  TestBed.configureTestingModule({
    providers: [
      { provide: MAT_DIALOG_DATA, useValue: data },
      { provide: MatDialogRef, useValue: { close } },
    ],
  });
  const fixture = TestBed.createComponent(CommandDialogComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  const element: HTMLElement = fixture.nativeElement;
  const confirm = () =>
    [...element.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('Confirm')
    ) as HTMLButtonElement;
  const typeReason = async (reason: string) => {
    const textarea = element.querySelector('textarea') as HTMLTextAreaElement;
    textarea.value = reason;
    textarea.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    await fixture.whenStable();
  };
  return { fixture, close, element, confirm, typeReason };
}

describe('CommandDialogComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('needs a reason before it confirms', async () => {
    const { close, element, confirm, typeReason } = await render({
      type: 'profile.reset',
      subject: 'Ada',
    });
    expect(element.textContent).toContain('Reset profile - Ada');
    expect(confirm().disabled).toBe(true);

    await typeReason('   ');
    expect(confirm().disabled).toBe(true);

    await typeReason('  rude name ');
    expect(confirm().disabled).toBe(false);
    confirm().click();
    expect(close).toHaveBeenCalledWith({ reason: 'rude name', args: {} });
  });

  it('asks a ban for its end and reason', async () => {
    jest.spyOn(Date, 'now').mockReturnValue(1_000);
    const { close, confirm, typeReason } = await render({
      type: 'player.ban',
      subject: 'Ada',
      ban: true,
    });
    await typeReason('aimbot');
    confirm().click();
    expect(close).toHaveBeenCalledWith({
      reason: 'aimbot',
      args: { until: 1_000 + 7 * 24 * 3_600_000, reason: 'cheating' },
    });
    jest.restoreAllMocks();
  });

  it('bars only when asked to', async () => {
    const { fixture, close, element, confirm, typeReason } = await render({
      type: 'board.hidePlayer',
      subject: 'Ada',
      bar: true,
    });
    await typeReason('smurf');
    confirm().click();
    expect(close).toHaveBeenLastCalledWith({ reason: 'smurf', args: {} });

    (element.querySelector('mat-slide-toggle button') as HTMLElement).click();
    fixture.detectChanges();
    await fixture.whenStable();
    confirm().click();
    expect(close).toHaveBeenLastCalledWith({
      reason: 'smurf',
      args: { bar: true },
    });
  });
});
