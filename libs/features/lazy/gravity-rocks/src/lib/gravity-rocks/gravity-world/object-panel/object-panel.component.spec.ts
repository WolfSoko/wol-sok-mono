/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { qaSelector } from '@wolsok/test-helper';
import { vec2 } from '@wolsok/utils-math';
import { EARTH_MASS, GRAVITATIONAL_CONSTANT } from '../domain/solar-system';
import { orbitAround, primaryOf } from '../domain/world-objects/orbit';
import { Planet } from '../domain/world-objects/planet';
import { Sun } from '../domain/world-objects/sun';
import { WorldObject } from '../domain/world-objects/world-object';
import {
  MAX_MASS_EXPONENT,
  MAX_SPEED,
  MIN_MASS_EXPONENT,
  ObjectPanelComponent,
} from './object-panel.component';

/** A world six AU wide with the sun in the middle and a planet an AU out. */
const CENTER = vec2(3, 1.8);
const REACH = 3;

describe('ObjectPanelComponent', () => {
  let fixture: ComponentFixture<ObjectPanelComponent>;
  let panel: ObjectPanelComponent;
  let sun: Sun;
  let planet: Planet;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ObjectPanelComponent],
      providers: [provideNoopAnimations()],
    }).compileComponents();

    sun = new Sun(CENTER, undefined, 1);
    planet = new Planet(CENTER.add(vec2(1, 0)), vec2(0, -6.28), EARTH_MASS);
    planet.parent = sun;

    fixture = TestBed.createComponent(ObjectPanelComponent);
    panel = fixture.componentInstance;
    // the panel only ever asks; applying it to the body is the world's job,
    // and the ranges it offers next are read back off the body
    panel.massChange.subscribe((mass) => (panel.target().mass = mass));
    panel.distanceChange.subscribe((distance) => moveOntoOrbit(distance));
    show(planet);
  });

  /** Moves the target onto a circular orbit, the way the world does. */
  function moveOntoOrbit(distance: number): void {
    const target: WorldObject = panel.target();
    const primary: WorldObject | undefined = primaryOf(target, sun);
    if (!primary) {
      return;
    }
    const { pos, vel } = orbitAround(
      primary,
      distance,
      Math.atan2(target.pos.y - primary.pos.y, target.pos.x - primary.pos.x),
      GRAVITATIONAL_CONSTANT
    );
    target.pos = pos;
    target.vel = vel;
  }

  /** Hands the panel a body the way the world template would. */
  function show(target: WorldObject): void {
    fixture.componentRef.setInput('target', target);
    fixture.componentRef.setInput('sun', sun);
    fixture.componentRef.setInput('title', target.id);
    fixture.componentRef.setInput(
      'gravitationalConstant',
      GRAVITATIONAL_CONSTANT
    );
    fixture.componentRef.setInput('reach', REACH);
    fixture.componentRef.setInput('world', [sun, planet]);
    fixture.detectChanges();
  }

  /** Reports that the bodies have moved, the way the world does each frame. */
  function worldMoved(): void {
    fixture.componentRef.setInput('world', [sun, planet]);
    fixture.detectChanges();
  }

  function byQa<T extends HTMLElement>(qa: string): T | null {
    return fixture.nativeElement.querySelector(qaSelector(qa));
  }

  it('should fill its sliders from the body it is given', () => {
    expect(panel.mass()).toBeCloseTo(1, 6);
    expect(panel.massExponent()).toBeCloseTo(0, 6);
    expect(panel.speed()).toBeCloseTo(6.28, 6);
    expect(panel.distance()).toBeCloseTo(1, 6);
  });

  it('should refill them when it is handed another body', () => {
    show(sun);

    expect(panel.mass()).toBeCloseTo(1 / EARTH_MASS, 0);
    expect(panel.speed()).toBe(0);
    expect(panel.distance()).toBe(0);
  });

  it('should name what the body orbits and what it would be given', () => {
    expect(panel.parentName()).toBe('sun');
    expect(panel.satelliteName()).toBe('moon');

    show(sun);

    // the sun orbits nothing, and what it is given is a planet
    expect(panel.parentName()).toBe('');
    expect(panel.satelliteName()).toBe('planet');
  });

  it('should offer no distance slider for the sun, which orbits nothing', () => {
    expect(byQa('menu-distance')).toBeTruthy();

    show(sun);

    expect(byQa('menu-distance')).toBeNull();
  });

  it('should offer no speed slider for a body that never moves', () => {
    expect(byQa('menu-speed')).toBeTruthy();

    show(sun);

    expect(byQa('menu-speed')).toBeNull();
  });

  it('should report a mass in solar masses off a slider counting earths', () => {
    const masses: number[] = [];
    panel.massChange.subscribe((mass) => masses.push(mass));

    panel.setMassExponent(3);

    expect(panel.mass()).toBeCloseTo(1000, 6);
    expect(masses).toEqual([1000 * EARTH_MASS]);
  });

  it('should keep the mass slider inside its own scale', () => {
    panel.setMassExponent(MAX_MASS_EXPONENT + 5);
    expect(panel.massExponent()).toBe(MAX_MASS_EXPONENT);

    panel.setMassExponent(MIN_MASS_EXPONENT - 5);
    expect(panel.massExponent()).toBe(MIN_MASS_EXPONENT);
  });

  it('should keep the orbit it offers inside what the body can hold', () => {
    const { min, max } = panel.orbitRange();

    panel.setOrbitDistance(max * 10);
    expect(panel.orbit()).toBe(max);

    panel.setOrbitDistance(0);
    expect(panel.orbit()).toBe(min);
  });

  it('should widen the orbit it offers as the body grows', () => {
    const before = panel.orbitRange();
    panel.setMassExponent(5);

    expect(panel.orbitRange().max).toBeGreaterThan(before.max);
  });

  it('should keep the distance it asks for inside what its primary allows', () => {
    const asked: number[] = [];
    panel.distanceChange.subscribe((distance) => asked.push(distance));
    const { min, max } = panel.distanceRange();

    panel.setDistance(max * 10);
    panel.setDistance(0);

    expect(asked).toEqual([max, min]);
  });

  it('should ask for nothing when the body has no primary to move against', () => {
    show(sun);
    const asked: number[] = [];
    panel.distanceChange.subscribe((distance) => asked.push(distance));

    panel.setDistance(1);

    expect(asked).toEqual([]);
  });

  it('should keep the speed it asks for inside the slider', () => {
    const asked: number[] = [];
    panel.speedChange.subscribe((speed) => asked.push(speed));

    panel.setSpeed(MAX_SPEED + 100);
    panel.setSpeed(-5);

    expect(asked).toEqual([MAX_SPEED, 0]);
    expect(panel.speed()).toBe(0);
  });

  it('should read back where the body really is after the world moved it', () => {
    planet.pos = CENTER.add(vec2(2, 0));
    planet.vel = vec2(0, -3);

    worldMoved();

    expect(panel.distance()).toBeCloseTo(2, 6);
    expect(panel.speed()).toBeCloseTo(3, 6);
  });

  it('should warn that a light body cannot keep the orbit it offers', () => {
    // an earth is drawn a thousand times wider than it is, so its grip on
    // anything clear of its own disc is one the sun takes over
    expect(panel.held()).toBe(false);
    expect(byQa('orbit-hint')).toBeTruthy();
  });

  it('should drop the warning once the body is heavy enough', () => {
    panel.setMassExponent(MAX_MASS_EXPONENT);
    fixture.detectChanges();

    expect(panel.held()).toBe(true);
    expect(byQa('orbit-hint')).toBeNull();
  });

  it('should ask for a satellite on the orbit the slider is set to', () => {
    const asked: number[] = [];
    panel.addSatellite.subscribe((orbit) => asked.push(orbit));

    byQa<HTMLButtonElement>('cta-add-satellite')!.click();

    expect(asked).toEqual([panel.orbit()]);
  });

  it('should ask for the body to be taken out of the world', () => {
    const removed = jest.fn();
    panel.remove.subscribe(removed);

    byQa<HTMLButtonElement>('cta-remove-target')!.click();

    expect(removed).toHaveBeenCalledTimes(1);
  });

  it('should not offer to remove the sun', () => {
    expect(byQa('cta-remove-target')).toBeTruthy();

    show(sun);

    expect(byQa('cta-remove-target')).toBeNull();
  });

  it('should report that it was closed', () => {
    const closed = jest.fn();
    panel.closed.subscribe(closed);

    byQa<HTMLButtonElement>('cta-close-panel')!.click();

    expect(closed).toHaveBeenCalledTimes(1);
  });

  it('should show the title it was given', () => {
    expect(byQa('object-panel-title')?.textContent?.trim()).toBe(planet.id);
  });

  it('should give every slider a step it can take', () => {
    // a range with nothing to choose still needs a step a slider accepts
    expect(panel.orbitStep()).toBeGreaterThan(0);
    expect(panel.distanceStep()).toBeGreaterThan(0);

    show(sun);

    expect(panel.distanceStep()).toBeGreaterThan(0);
  });
});
