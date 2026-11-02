import { I18nService } from '../i18n/i18n.service';
import { TestBed } from '@angular/core/testing';
import { RankBadgeComponent } from './rank-badge.component';

describe('RankBadgeComponent', () => {
  it('shows the initial and a pip per rank climbed', () => {
    const fixture = TestBed.createComponent(RankBadgeComponent);
    fixture.componentRef.setInput('name', 'Bacillus');
    fixture.componentRef.setInput('number', 3);
    fixture.detectChanges();
    const host: HTMLElement = fixture.nativeElement;

    expect(host.getAttribute('aria-label')).toBe('Rank: Bacillus');
    expect(host.querySelector('text')?.textContent?.trim()).toBe('B');
    expect(host.querySelectorAll('.pip')).toHaveLength(3);
  });

  it('names the rank in German', () => {
    TestBed.inject(I18nService).setLanguage('de');
    const fixture = TestBed.createComponent(RankBadgeComponent);
    fixture.componentRef.setInput('name', 'Bazillus');
    fixture.componentRef.setInput('number', 3);
    fixture.detectChanges();

    expect(fixture.nativeElement.getAttribute('aria-label')).toBe(
      'Rang: Bazillus'
    );
  });
});
