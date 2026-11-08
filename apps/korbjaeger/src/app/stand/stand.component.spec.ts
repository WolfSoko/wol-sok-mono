import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Stand } from '../basketball-data/stand';
import { JETZT } from '../jetzt';
import { StandComponent } from './stand.component';

const GESPEICHERT = Date.parse('2026-11-08T09:05:00+01:00');
const ZWEI_STUNDEN = 2 * 60 * 60_000;

function render(stand: Stand | undefined, jetzt = signal(GESPEICHERT)) {
  TestBed.configureTestingModule({
    providers: [{ provide: JETZT, useValue: jetzt }],
  });
  const fixture = TestBed.createComponent(StandComponent);
  fixture.componentRef.setInput('stand', stand);
  fixture.detectChanges();
  return { fixture, element: fixture.nativeElement as HTMLElement };
}

describe('StandComponent', () => {
  it('says why and since when a screen shows its last good data', () => {
    const { element } = render(
      { gespeichertAm: GESPEICHERT, grund: 'offline' },
      signal(GESPEICHERT + ZWEI_STUNDEN)
    );

    const text = element.querySelector('[data-qa="stand"] span')?.textContent;
    expect(text?.replace(/\s+/g, ' ').trim()).toBe(
      'Offline · Stand: vor 2 Std.'
    );
    const zeit = element.querySelector('time');
    expect(zeit?.getAttribute('datetime')).toBe('2026-11-08T08:05:00.000Z');
    expect(zeit?.getAttribute('title')).toBe('08.11.2026, 09:05');
  });

  it('names a DBB that could not be reached', () => {
    const { element } = render({
      gespeichertAm: GESPEICHERT,
      grund: 'unavailable',
    });

    expect(element.textContent).toContain('DBB nicht erreichbar');
  });

  it('ages with the clock', () => {
    const jetzt = signal(GESPEICHERT);
    const { fixture, element } = render(
      { gespeichertAm: GESPEICHERT, grund: 'offline' },
      jetzt
    );

    jetzt.set(GESPEICHERT + ZWEI_STUNDEN);
    fixture.detectChanges();

    expect(element.textContent).toContain('Stand: vor 2 Std.');
  });

  it('shows nothing for data just read', () => {
    const { element } = render(undefined);

    expect(element.textContent?.trim()).toBe('');
  });
});
