import { TestBed } from '@angular/core/testing';
import { RankStandingComponent } from './rank-standing.component';

describe('RankStandingComponent', () => {
  function render(xp: number): HTMLElement {
    const fixture = TestBed.createComponent(RankStandingComponent);
    fixture.componentRef.setInput('xp', xp);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('shows the rank and the XP to the next one', () => {
    const host = render(1240);

    expect(host.querySelector('.rank-name')?.textContent).toBe('Bacillus');
    expect(host.querySelector('.rank-label')?.textContent).toBe('Rank 3 of 8');
    expect(host.querySelector('.xp-line')?.textContent).toContain('1,240 XP');
    expect(host.querySelector('.xp-line')?.textContent).toContain(
      '260 to Spirillum'
    );
  });

  it('has no next rank at the top', () => {
    expect(render(20_000).querySelector('.xp-line')?.textContent).not.toContain(
      ' to '
    );
  });
});
