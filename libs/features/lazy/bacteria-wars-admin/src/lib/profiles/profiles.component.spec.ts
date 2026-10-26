import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { defaultProfile } from '@wolsok/feat-lazy-bac-game/admin-kit';
import { AdminActionsService } from '../moderation/admin-actions.service';
import {
  AdminRecordsService,
  type ProfileFilter,
} from '../moderation/admin-records.service';
import { ProfilesComponent } from './profiles.component';

const IMAGE = 'data:image/webp;base64,AAAA';

function render() {
  const profiles = jest.fn(async (filter: ProfileFilter) => ({
    rows: [
      {
        uid: 'ada',
        profile: {
          ...defaultProfile('ada'),
          name: filter.by === 'name' ? 'Adam' : 'Ada',
          avatar:
            filter.by === 'pictures'
              ? { kind: 'image' as const, data: IMAGE }
              : { kind: 'preset' as const, id: 1 },
        },
        updatedAt: Date.UTC(2026, 9, 25),
      },
    ],
    next: null,
  }));
  const run = jest.fn(async () => ({ ok: true }));
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: AdminRecordsService, useValue: { profiles } },
      { provide: AdminActionsService, useValue: { run } },
    ],
  });
  const fixture = TestBed.createComponent(ProfilesComponent);
  const element: HTMLElement = fixture.nativeElement;
  const settle = async () => {
    await fixture.whenStable();
    fixture.detectChanges();
  };
  const button = (label: string) =>
    [...element.querySelectorAll('button')].find((b) =>
      b.textContent?.includes(label)
    ) as HTMLButtonElement;
  const type = async (text: string) => {
    const input = element.querySelector('input') as HTMLInputElement;
    input.value = text;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  return { fixture, element, profiles, run, settle, button, type };
}

describe('ProfilesComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('lists the newest profiles, linking to the player', async () => {
    const { element, profiles, settle } = render();
    await settle();
    expect(profiles).toHaveBeenCalledWith({ by: 'newest' }, null);
    expect(element.textContent).toContain('Ada');
    expect(element.querySelector('a')?.getAttribute('href')).toBe(
      '/player/ada'
    );
  });

  it('removes an uploaded picture from the list of pictures', async () => {
    const { element, profiles, run, settle, button } = render();
    await settle();
    (
      element.querySelectorAll('mat-button-toggle button')[1] as HTMLElement
    ).click();
    await settle();
    expect(profiles).toHaveBeenLastCalledWith({ by: 'pictures' }, null);

    button('Remove picture').click();
    await settle();
    expect(run).toHaveBeenCalledWith({
      type: 'profile.removeImage',
      subject: 'Ada',
      target: { uid: 'ada' },
    });
    expect(profiles).toHaveBeenCalledTimes(3);
  });

  it('searches by name, and opens a uid', async () => {
    const { profiles, settle, button, type } = render();
    await settle();
    await type('Ad');
    button('Search').click();
    await settle();
    expect(profiles).toHaveBeenLastCalledWith(
      { by: 'name', prefix: 'Ad' },
      null
    );
    expect(button('Open as uid').disabled).toBe(false);

    const navigate = jest
      .spyOn(TestBed.inject(Router), 'navigate')
      .mockResolvedValue(true);
    button('Open as uid').click();
    expect(navigate).toHaveBeenCalledWith(['../player', 'Ad'], {
      relativeTo: expect.anything(),
    });

    await type('not a uid');
    expect(button('Open as uid').disabled).toBe(true);
  });
});
