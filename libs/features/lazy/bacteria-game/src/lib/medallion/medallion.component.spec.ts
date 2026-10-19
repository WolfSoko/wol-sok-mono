import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MedalTier } from '../state/medallions';
import { MedallionComponent } from './medallion.component';

describe('MedallionComponent', () => {
  function render(
    tier: MedalTier | null,
    difficulty: string | null = null
  ): ComponentFixture<MedallionComponent> {
    const fixture = TestBed.createComponent(MedallionComponent);
    fixture.componentRef.setInput('tier', tier);
    fixture.componentRef.setInput('difficulty', difficulty);
    fixture.componentRef.setInput('size', 64);
    fixture.detectChanges();
    return fixture;
  }

  it('embosses one bacterium more per tier', () => {
    const embossed = (tier: MedalTier) =>
      // Every bacterium is a highlight and a body.
      render(tier).nativeElement.querySelectorAll('svg > circle').length - 3;
    expect(embossed('bronze')).toBe(2);
    expect(embossed('silver')).toBe(4);
    expect(embossed('gold')).toBe(6);
    expect(embossed('platinum')).toBe(8);
  });

  it('names the medallion for screen readers', () => {
    const host: HTMLElement = render('gold').nativeElement;
    expect(host.getAttribute('role')).toBe('img');
    expect(host.getAttribute('aria-label')).toBe('Gold medallion');
    expect(host.style.width).toBe('64px');
  });

  it('shows an empty slot before the level is won', () => {
    const host: HTMLElement = render(null).nativeElement;
    expect(host.getAttribute('aria-label')).toBe('No medallion yet');
    expect(host.querySelectorAll('circle')).toHaveLength(1);
  });

  it('gives each medallion gradients of its own', () => {
    const ids = [render('gold'), render('silver')].map(
      (fixture) =>
        fixture.nativeElement.querySelector('radialGradient')?.id as string
    );
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('marks the difficulty with its initial', () => {
    const host: HTMLElement = render('bronze', 'hard').nativeElement;
    expect(host.querySelector('text')?.textContent?.trim()).toBe('H');
    expect(render('bronze').nativeElement.querySelector('text')).toBeNull();
  });

  it('names the difficulty in the label, and in an empty slot', () => {
    expect(
      render('gold', 'hard').nativeElement.getAttribute('aria-label')
    ).toBe('Gold medallion, Hard');
    const slot: HTMLElement = render(null, 'easy').nativeElement;
    expect(slot.getAttribute('aria-label')).toBe('No medallion yet, Easy');
    expect(slot.querySelector('.slot-letter')?.textContent?.trim()).toBe('E');
  });

  it('leaves the chip off a medallion too small to read it', () => {
    const fixture = TestBed.createComponent(MedallionComponent);
    fixture.componentRef.setInput('tier', 'gold');
    fixture.componentRef.setInput('difficulty', 'hard');
    fixture.componentRef.setInput('size', 22);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.chip')).toBeNull();
  });

  it('lets only platinum shine', () => {
    expect(
      render('platinum').nativeElement.querySelector('.sheen')
    ).not.toBeNull();
    expect(render('gold').nativeElement.querySelector('.sheen')).toBeNull();
  });
});
