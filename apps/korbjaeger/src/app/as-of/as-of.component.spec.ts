import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { AsOf } from '../basketball-data/as-of';
import { NOW } from '../now';
import { AsOfComponent } from './as-of.component';

const STORED = Date.parse('2026-11-08T09:05:00+01:00');
const TWO_HOURS = 2 * 60 * 60_000;

function render(asOf: AsOf | undefined, now = signal(STORED)) {
  TestBed.configureTestingModule({
    providers: [{ provide: NOW, useValue: now }],
  });
  const fixture = TestBed.createComponent(AsOfComponent);
  fixture.componentRef.setInput('asOf', asOf);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('AsOfComponent', () => {
  it('says why and since when a screen shows its last good data', () => {
    const { element } = render(
      { storedAt: STORED, reason: 'no-internet' },
      signal(STORED + TWO_HOURS)
    );

    const text = element.querySelector('[data-qa="as-of"] span')?.textContent;
    expect(text?.replace(/\s+/g, ' ').trim()).toBe(
      'Offline · Stand: vor 2 Std.'
    );
    const time = element.querySelector('time');
    expect(time?.getAttribute('datetime')).toBe('2026-11-08T08:05:00.000Z');
    expect(time?.getAttribute('title')).toBe('08.11.2026, 09:05');
  });

  it('names a DBB that could not be reached', () => {
    const { element } = render({
      storedAt: STORED,
      reason: 'unavailable',
    });

    expect(element.textContent).toContain('DBB nicht erreichbar');
  });

  it('ages with the clock', () => {
    const now = signal(STORED);
    const { fixture, element } = render(
      { storedAt: STORED, reason: 'no-internet' },
      now
    );

    now.set(STORED + TWO_HOURS);
    fixture.detectChanges();

    expect(element.textContent).toContain('Stand: vor 2 Std.');
  });

  it('shows nothing for data just read', () => {
    const { element } = render(undefined);

    expect(element.textContent?.trim()).toBe('');
  });
});
