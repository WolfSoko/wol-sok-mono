import { Component, input, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ClubId } from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import { fakeSelection } from '@wolsok/feat-korbjaeger-selection/testing';
import type {
  ClubColorsChoice,
  ClubColors,
} from '@wolsok/feat-korbjaeger-selection';
import { colorSchemeTokens } from './color-scheme';
import { ColorSchemeDirective, applyClubColors } from './apply-club-colors';

/** A component wearing a Verein's colours, as the Team page does. */
@Component({ selector: 'korb-in-club', template: '' })
class InClub {
  public readonly club = input<ClubId | undefined>();

  public constructor() {
    applyClubColors(this.club);
  }
}

@Component({
  imports: [InClub, ColorSchemeDirective],
  template: `
    <korb-in-club data-qa="club" [club]="club()" />
    <section data-qa="preview" [korbColorScheme]="colors()"></section>
  `,
})
class Page {
  public readonly club = signal<ClubId | undefined>(4242);
  public readonly colors = signal<ClubColors | undefined>(undefined);
}

const ROT: ClubColorsChoice = { clubId: 4242, primary: '#c8102e' };

async function openPage(clubColors: readonly ClubColorsChoice[] = [ROT]) {
  const colors = signal<readonly ClubColorsChoice[] | undefined>(clubColors);
  TestBed.configureTestingModule({
    providers: [
      { provide: AUSWAHL, useValue: fakeSelection({ clubColors: colors }) },
    ],
  });
  const fixture = TestBed.createComponent(Page);
  const settled = async () => {
    await fixture.whenStable();
    // the scheme loads in a chunk of its own
    await new Promise((done) => setTimeout(done));
    await fixture.whenStable();
  };
  await settled();
  const part = (qa: string) =>
    fixture.nativeElement.querySelector(`[data-qa="${qa}"]`) as HTMLElement;
  return { fixture, colors, settled, part };
}

const PRIMARY = '--mat-sys-primary';

describe('applyClubColors', () => {
  it("sets every system colour of the Verein's colours, light and dark", async () => {
    const { part } = await openPage();

    const tokens = colorSchemeTokens(ROT);
    const style = part('club').style;
    for (const [name, value] of Object.entries(tokens)) {
      expect(style.getPropertyValue(name)).toBe(value);
    }
  });

  it('sets nothing for a Verein without colours, the app’s own applying', async () => {
    const { part } = await openPage([]);

    expect(part('club').style.getPropertyValue(PRIMARY)).toBe('');
  });

  it('takes the colours away once they are reset', async () => {
    const { colors, settled, part } = await openPage();

    colors.set([]);
    await settled();

    expect(part('club').style.length).toBe(0);
  });

  it('keeps the colours while they are read again, so the page does not flash', async () => {
    const { colors, settled, part } = await openPage();
    const before = part('club').style.getPropertyValue(PRIMARY);

    // a sign-in switches stores: nothing read for a moment
    colors.set(undefined);
    await settled();

    expect(part('club').style.getPropertyValue(PRIMARY)).toBe(before);
  });

  it('follows another Verein, and a change of the colours', async () => {
    const { fixture, colors, settled, part } = await openPage();

    colors.set([ROT, { clubId: 4343, primary: '#1d4ed8' }]);
    fixture.componentInstance.club.set(4343);
    await settled();

    expect(part('club').style.getPropertyValue(PRIMARY)).toBe(
      colorSchemeTokens({ primary: '#1d4ed8' })[PRIMARY]
    );
  });
});

describe('ColorSchemeDirective', () => {
  it('sets the colours it is given, and none without', async () => {
    const { fixture, settled, part } = await openPage();
    expect(part('preview').style.length).toBe(0);

    fixture.componentInstance.colors.set({ primary: '#007a3d' });
    await settled();

    expect(part('preview').style.getPropertyValue(PRIMARY)).toBe(
      colorSchemeTokens({ primary: '#007a3d' })[PRIMARY]
    );
  });
});
