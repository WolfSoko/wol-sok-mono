import { TestBed } from '@angular/core/testing';
import { I18nService } from '../i18n/i18n.service';
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

  it('leads back to the menu unless told otherwise, in German too', () => {
    const fixture = TestBed.createComponent(ScreenHeaderComponent);
    fixture.componentRef.setInput('title', 'Profil');
    fixture.detectChanges();
    const back = () =>
      (fixture.nativeElement as HTMLElement).querySelector('.back')
        ?.textContent;
    expect(back()).toContain('Menu');

    TestBed.inject(I18nService).setLanguage('de');
    fixture.detectChanges();
    expect(back()).toContain('Menü');
  });
});
