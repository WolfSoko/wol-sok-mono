import { TestBed } from '@angular/core/testing';
import { swarm, SwarmComponent } from './swarm.component';

const COLORS = [
  [255, 100, 20],
  [0, 100, 230],
] as const;

describe('swarm', () => {
  it('is the same swarm for the same seed', () => {
    expect(swarm(10, COLORS, 3)).toEqual(swarm(10, COLORS, 3));
  });

  it('gathers each colony on its own side, in its own colour', () => {
    const cells = swarm(40, COLORS, 7);
    const left = cells.filter((_, index) => index % 2 === 0);
    const right = cells.filter((_, index) => index % 2 === 1);

    expect(left.every((cell) => cell.left <= 55 && cell.dx > 0)).toBe(true);
    expect(
      left.every((cell) => cell.background.includes('rgb(255, 100, 20)'))
    ).toBe(true);
    expect(right.every((cell) => cell.left >= 45 && cell.dx < 0)).toBe(true);
    expect(
      right.every((cell) => cell.background.includes('rgb(0, 100, 230)'))
    ).toBe(true);
  });
});

describe('SwarmComponent', () => {
  it('draws as many bacteria as asked, hidden from assistive technology', () => {
    const fixture = TestBed.createComponent(SwarmComponent);
    fixture.componentRef.setInput('colors', COLORS);
    fixture.componentRef.setInput('count', 12);
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelectorAll('.cell')).toHaveLength(12);
    expect(host.getAttribute('aria-hidden')).toBe('true');
  });
});
