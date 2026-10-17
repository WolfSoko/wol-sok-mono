import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SteeringVector } from '../touch-controls';
import { JoystickComponent } from './joystick.component';

/** A pointer event as the zone sees it; the zone sits at (100, 200) on screen. */
function pointer(
  pointerId: number,
  x: number,
  y: number
): PointerEvent & { preventDefault: jest.Mock } {
  return {
    pointerId,
    clientX: 100 + x,
    clientY: 200 + y,
    preventDefault: jest.fn(),
  } as unknown as PointerEvent & { preventDefault: jest.Mock };
}

describe('JoystickComponent', () => {
  let fixture: ComponentFixture<JoystickComponent>;
  let component: JoystickComponent;
  let steered: SteeringVector[];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JoystickComponent],
    }).compileComponents();
    fixture = TestBed.createComponent(JoystickComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('color', 'rgb(255, 100, 20)');
    fixture.componentRef.setInput('label', 'Orange');
    fixture.componentRef.setInput('radius', 50);
    steered = [];
    component.steer.subscribe((vector) => steered.push(vector));
    jest
      .spyOn(fixture.nativeElement, 'getBoundingClientRect')
      .mockReturnValue({ left: 100, top: 200, width: 160, height: 240 });
    fixture.nativeElement.setPointerCapture = jest.fn();
    await fixture.whenStable();
  });

  function down(id: number, x: number, y: number) {
    component['onPointerDown'](pointer(id, x, y));
  }

  function move(id: number, x: number, y: number) {
    component['onPointerMove'](pointer(id, x, y));
  }

  function up(id: number) {
    component['onPointerUp'](pointer(id, 0, 0));
  }

  it('centres the stick where the finger lands', () => {
    down(1, 40, 60);

    expect(component['origin']()).toEqual({ x: 40, y: 60 });
    expect(fixture.nativeElement.setPointerCapture).toHaveBeenCalledWith(1);
  });

  it('steers towards where the finger is dragged', () => {
    down(1, 40, 60);

    move(1, 90, 60);

    expect(steered).toEqual([{ x: 1, y: 0 }]);
    expect(component['knob']()).toEqual({ x: 50, y: 0 });
  });

  it('stops once the finger lifts', () => {
    down(1, 40, 60);
    move(1, 40, 10);

    up(1);

    expect(steered.at(-1)).toEqual({ x: 0, y: 0 });
    expect(component['origin']()).toBeNull();
  });

  it('ignores a second finger while the first one holds the stick', () => {
    down(1, 40, 60);

    down(2, 100, 100);
    move(2, 150, 100);

    expect(steered).toEqual([]);
    expect(component['origin']()).toEqual({ x: 40, y: 60 });
  });

  it('keeps the stick for the finger that lifts elsewhere', () => {
    down(1, 40, 60);

    up(2);

    expect(component['origin']()).not.toBeNull();
  });

  it('ignores every touch while disabled', () => {
    fixture.componentRef.setInput('disabled', true);

    down(1, 40, 60);
    move(1, 90, 60);

    expect(steered).toEqual([]);
    expect(component['origin']()).toBeNull();
  });
});
