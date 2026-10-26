import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminActionsService } from '../moderation/admin-actions.service';
import { AdminRecordsService } from '../moderation/admin-records.service';
import { BansComponent } from './bans.component';

describe('BansComponent', () => {
  it('lists the bans and lifts one', async () => {
    const bans = jest.fn(async () => ({
      rows: [
        { uid: 'ada', since: 1, until: null, reason: 'cheating' as const },
        { uid: 'bob', since: 1, until: 2, reason: 'spam' as const },
      ],
      next: null,
    }));
    const run = jest.fn(async () => ({ ok: true }));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AdminRecordsService, useValue: { bans } },
        { provide: AdminActionsService, useValue: { run } },
      ],
    });
    const fixture = TestBed.createComponent(BansComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('For good');
    expect(element.textContent).toContain('Cheating');
    expect(element.querySelector('.ended')).not.toBeNull();
    // Only the ban that holds can have its end changed.
    expect(
      [...element.querySelectorAll('td button')].filter((b) =>
        b.textContent?.includes('Change end')
      )
    ).toHaveLength(1);

    const button = (label: string) =>
      [...element.querySelectorAll('td button')].find((b) =>
        b.textContent?.includes(label)
      ) as HTMLButtonElement;
    button('Lift ban').click();
    await fixture.whenStable();
    expect(run).toHaveBeenLastCalledWith({
      type: 'player.unban',
      subject: 'ada',
      target: { uid: 'ada' },
    });
    expect(bans).toHaveBeenCalledTimes(2);

    button('Change end').click();
    await fixture.whenStable();
    expect(run).toHaveBeenLastCalledWith({
      type: 'player.ban',
      ban: true,
      subject: 'ada',
      target: { uid: 'ada' },
    });
  });
});
