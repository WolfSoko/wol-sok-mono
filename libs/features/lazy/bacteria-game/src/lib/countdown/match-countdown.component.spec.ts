import { TestBed } from '@angular/core/testing';
import { MatchCountdownComponent } from './match-countdown.component';

describe('MatchCountdownComponent', () => {
  function render(count: number): HTMLElement {
    const fixture = TestBed.createComponent(MatchCountdownComponent);
    fixture.componentRef.setInput('count', count);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the number left', () => {
    expect(render(3).querySelector('.number')?.textContent?.trim()).toBe('3');
  });

  it('announces the number to a screen reader as it changes', () => {
    const status = render(2).querySelector('[role="status"]');

    expect(status?.getAttribute('aria-live')).toBe('assertive');
    expect(status?.textContent).toContain('2');
  });
});
