import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

/** Renders a component that needs only the router, and returns its element. */
export function zeigen(komponente: Type<unknown>): HTMLElement {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(komponente);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}
