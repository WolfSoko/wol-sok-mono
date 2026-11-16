import { TestBed } from '@angular/core/testing';
import { BacteriaSpinnerComponent } from './bacteria-spinner.component';

describe('BacteriaSpinnerComponent', () => {
  function render(label = 'Loading'): HTMLElement {
    const fixture = TestBed.createComponent(BacteriaSpinnerComponent);
    fixture.componentRef.setInput('label', label);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('seats six bacteria round the ring, player and opponent in turn', () => {
    const seats = Array.from(
      render().querySelectorAll<HTMLElement>('.seat')
    ).map((seat) => [
      seat.style.getPropertyValue('--index'),
      seat.querySelector('.cell')?.classList.contains('opponent'),
    ]);

    expect(seats).toEqual([
      ['0', false],
      ['1', true],
      ['2', false],
      ['3', true],
      ['4', false],
      ['5', true],
    ]);
  });

  it('tells screen readers it is busy', () => {
    const host = render('Getting ready');

    expect(host.getAttribute('role')).toBe('progressbar');
    expect(host.getAttribute('aria-label')).toBe('Getting ready');
  });
});
