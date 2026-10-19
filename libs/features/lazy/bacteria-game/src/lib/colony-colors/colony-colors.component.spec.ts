import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ColonyColorsComponent } from './colony-colors.component';

describe('ColonyColorsComponent', () => {
  let fixture: ComponentFixture<ColonyColorsComponent>;

  function render(mode: 'vs-computer' | 'two-players'): HTMLElement {
    fixture = TestBed.createComponent(ColonyColorsComponent);
    fixture.componentRef.setInput('mode', mode);
    fixture.componentRef.setInput('colors', ['orange', 'blue']);
    fixture.detectChanges();
    return fixture.nativeElement;
  }

  it('names the seats after who sits there', () => {
    const names = (host: HTMLElement) =>
      Array.from(host.querySelectorAll('.seat-name')).map((n) =>
        n.textContent?.trim()
      );

    expect(names(render('vs-computer'))).toEqual(['You', 'Computer']);
    expect(names(render('two-players'))).toEqual([
      'Left player',
      'Right player',
    ]);
  });

  it('reports the colour a seat picks', () => {
    const host = render('two-players');
    const picked = jest.fn();
    fixture.componentInstance.colorChange.subscribe(picked);

    host
      .querySelectorAll('mat-button-toggle-group')[1]
      .querySelector<HTMLButtonElement>(
        '[aria-label="Green"] button, button[aria-label="Green"]'
      )
      ?.click();

    expect(picked).toHaveBeenCalledWith({ seat: 1, colorId: 'green' });
  });

  it('locks the colours still to earn, but not one a seat has', () => {
    fixture = TestBed.createComponent(ColonyColorsComponent);
    fixture.componentRef.setInput('mode', 'two-players');
    fixture.componentRef.setInput('colors', ['orange', 'green']);
    fixture.componentRef.setInput('locks', { green: 'Earn First Blood' });
    fixture.detectChanges();
    const groups = (fixture.nativeElement as HTMLElement).querySelectorAll(
      'mat-button-toggle-group'
    );
    const greenOf = (seat: number) =>
      groups[seat].querySelector<HTMLButtonElement>(
        'button[aria-label^="Green"]'
      );

    expect(greenOf(0)?.disabled).toBe(true);
    expect(greenOf(0)?.getAttribute('aria-label')).toBe(
      'Green, locked: Earn First Blood'
    );
    expect(greenOf(1)?.disabled).toBe(false);
  });
});
