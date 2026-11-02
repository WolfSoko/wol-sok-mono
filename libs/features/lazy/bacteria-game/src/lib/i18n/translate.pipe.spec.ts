import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { I18nService } from './i18n.service';
import { TranslatePipe } from './translate.pipe';

@Component({
  imports: [TranslatePipe],
  template: `
    <h2>{{ 'settings.title' | t }}</h2>
    <p>{{ 'settings.display.cells' | t: { width: 4, height: 2 } }}</p>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class HostComponent {}

describe('TranslatePipe', () => {
  it('shows the text in the active language and follows a switch', async () => {
    const fixture = TestBed.createComponent(HostComponent);
    await fixture.whenStable();
    const text = () => fixture.nativeElement.textContent.replace(/\s+/g, ' ');

    expect(text()).toContain('Settings');
    expect(text()).toContain('4 × 2 cells');

    TestBed.inject(I18nService).setLanguage('de');
    await fixture.whenStable();

    expect(text()).toContain('Einstellungen');
    expect(text()).toContain('4 × 2 Zellen');
  });
});
