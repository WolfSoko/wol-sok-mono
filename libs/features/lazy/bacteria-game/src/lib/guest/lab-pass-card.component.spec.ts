import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LabPassStep, labPassSteps, LabPassFacts, nextStep } from './lab-pass';
import { LabPassCardComponent, LabPassPage } from './lab-pass-card.component';
import { LabPass } from './lab-pass.service';
import { SignIn } from './sign-in.service';

describe('LabPassCardComponent', () => {
  let facts: ReturnType<typeof signal<LabPassFacts>>;
  let justEarned: ReturnType<typeof signal<boolean>>;
  let urgent: ReturnType<typeof signal<boolean>>;
  let pass: {
    steps: () => readonly LabPassStep[];
    next: () => string | null;
    done: () => number;
    justEarned: typeof justEarned;
    urgent: typeof urgent;
    dismiss: jest.Mock;
    close: jest.Mock;
  };
  let signIn: {
    signIn: jest.Mock;
    ready: () => boolean;
    failed: () => boolean;
  };

  async function render(start: Partial<LabPassFacts> = {}) {
    facts = signal<LabPassFacts>({
      signedIn: false,
      profileSaved: false,
      motto: false,
      friend: false,
      ...start,
    });
    justEarned = signal(false);
    urgent = signal(false);
    const steps = computed(() => labPassSteps(facts()));
    pass = {
      steps,
      next: computed(() => nextStep(steps())),
      done: computed(() => steps().filter(({ done }) => done).length),
      justEarned,
      urgent,
      dismiss: jest.fn(),
      close: jest.fn(),
    };
    signIn = {
      signIn: jest.fn(() => Promise.resolve()),
      ready: () => true,
      failed: () => false,
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: LabPass, useValue: pass },
        { provide: SignIn, useValue: signIn },
      ],
    });
    const fixture = TestBed.createComponent(LabPassCardComponent);
    const opened: LabPassPage[] = [];
    fixture.componentInstance.open.subscribe((page) => opened.push(page));
    await fixture.whenStable();
    return { fixture, opened };
  }

  const text = (element: HTMLElement) =>
    (element.textContent ?? '').replace(/\s+/g, ' ');
  const buttons = (element: HTMLElement): HTMLButtonElement[] =>
    Array.from(element.querySelectorAll('button'));

  it('shows a guest the pass, its reward and signing in as the next step', async () => {
    const { fixture } = await render();
    const element: HTMLElement = fixture.nativeElement;

    expect(text(element)).toContain('Lab Pass');
    expect(text(element)).toContain('0 of 4 done');
    expect(text(element)).toContain('Complete it to earn Lab Member.');
    expect(element.querySelectorAll('.cell.done')).toHaveLength(0);

    buttons(element)[0].click();
    expect(signIn.signIn).toHaveBeenCalled();
  });

  it('tells a guest due for it that an unused account is deleted', async () => {
    const { fixture } = await render();
    expect(text(fixture.nativeElement)).not.toContain('90 days');

    urgent.set(true);
    await fixture.whenStable();
    expect(text(fixture.nativeElement)).toContain(
      'If you do not open the game for 90 days'
    );
  });

  it.each([
    [{ signedIn: true }, 'Make profile', 'profile'],
    [{ signedIn: true, profileSaved: true }, 'Write motto', 'profile'],
    [
      { signedIn: true, profileSaved: true, motto: true },
      'Find friends',
      'friends',
    ],
  ] as const)('leads from %j on with "%s"', async (done, label, page) => {
    const { fixture, opened } = await render(done);
    const go = buttons(fixture.nativeElement)[0];

    expect(go.textContent).toContain(label);
    go.click();
    expect(opened).toEqual([page]);
  });

  it('fills a cell of the dish per step done', async () => {
    const { fixture } = await render({ signedIn: true, profileSaved: true });

    expect(fixture.nativeElement.querySelectorAll('.cell.done')).toHaveLength(
      2
    );
  });

  it('puts itself away on "Later"', async () => {
    const { fixture } = await render();
    const later = buttons(fixture.nativeElement)[1];

    expect(later.textContent?.trim()).toBe('Later');
    later.click();
    expect(pass.dismiss).toHaveBeenCalled();
  });

  it('tells the player the achievement they earned', async () => {
    const { fixture } = await render({
      signedIn: true,
      profileSaved: true,
      motto: true,
      friend: true,
    });
    justEarned.set(true);
    await fixture.whenStable();
    const element: HTMLElement = fixture.nativeElement;

    expect(text(element)).toContain('Welcome to the lab!');
    expect(text(element)).toContain('You earned Lab Member: +50 XP.');
    buttons(element)[0].click();
    expect(pass.close).toHaveBeenCalled();
  });
});
