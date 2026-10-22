import { TestBed } from '@angular/core/testing';
import { ScreenHeaderComponent } from './screen-header.component';

describe('ScreenHeaderComponent', () => {
  it('shows the title and reports the way back', () => {
    const fixture = TestBed.createComponent(ScreenHeaderComponent);
    fixture.componentRef.setInput('title', 'Profile');
    fixture.componentRef.setInput('backLabel', 'Pause menu');
    fixture.detectChanges();
    const back = jest.fn();
    fixture.componentInstance.back.subscribe(back);
    const host: HTMLElement = fixture.nativeElement;

    host.querySelector<HTMLButtonElement>('.back')?.click();

    expect(host.querySelector('h2')?.textContent).toBe('Profile');
    expect(host.querySelector('.back')?.textContent).toContain('Pause menu');
    expect(back).toHaveBeenCalled();
  });
});
