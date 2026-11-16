import { TestBed } from '@angular/core/testing';
import { BacteriaSpinnerComponent } from './bacteria-spinner.component';

describe('BacteriaSpinnerComponent', () => {
  function render(label = 'Loading'): HTMLElement {
    const fixture = TestBed.createComponent(BacteriaSpinnerComponent);
    fixture.componentRef.setInput('label', label);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('puts six bacteria on the ring, player and opponent in turn', () => {
    const cells = Array.from(render().querySelectorAll('.cell'));

    expect(cells.map((cell) => cell.classList.contains('opponent'))).toEqual([
      false,
      true,
      false,
      true,
      false,
      true,
    ]);
  });

  it('gives each bacterium its own place on the ring', () => {
    const seats = Array.from(
      render().querySelectorAll<HTMLElement>('.seat')
    ).map((seat) => seat.style.getPropertyValue('--index'));

    expect(seats).toEqual(['0', '1', '2', '3', '4', '5']);
  });

  it('tells screen readers it is busy', () => {
    const host = render('Getting ready');

    expect(host.getAttribute('role')).toBe('progressbar');
    expect(host.getAttribute('aria-label')).toBe('Getting ready');
  });
});
