import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SteeringVector } from '../state/geometry';
import { JOYSTICK_RADIUS, JoystickComponent } from './joystick.component';

/** A pointer event as the zone sees it; the zone sits at (100, 200) on screen. */
function pointer(
  pointerId: number,
  x: number,
  y: number,
  button = 0
): PointerEvent & { preventDefault: jest.Mock } {
  return {
    pointerId,
    button,
    clientX: 100 + x,
    clientY: 200 + y,
    preventDefault: jest.fn(),
  } as unknown as PointerEvent & { preventDefault: jest.Mock };
}

const RIM = JOYSTICK_RADIUS;

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

    move(1, 40 + RIM, 60);

    expect(steered).toEqual([{ x: 1, y: 0 }]);
    expect(component['knob']()).toEqual({ x: RIM, y: 0 });
  });

  it("draws the knob in the zone's own frame when its seat is turned", () => {
    // The seat at the left edge is turned a quarter clockwise: the zone's
    // left end is at the top of the screen.
    fixture.componentRef.setInput('turn', 90);
    (fixture.nativeElement.getBoundingClientRect as jest.Mock).mockReturnValue({
      left: 100,
      top: 200,
      width: 150,
      height: 240,
    });
    down(1, 75, 0);

    move(1, 75 + RIM, 0);

    // The push is reported as it is on the screen, to the right ...
    expect(steered).toEqual([{ x: 1, y: 0 }]);
    // ... while in the zone the finger landed at the left end and the knob
    // moved up, which is right once the seat is turned.
    expect(component['origin']()).toEqual({ x: 0, y: 75 });
    expect(component['knob']()).toEqual({ x: 0, y: -RIM });
  });

  it('ignores a mouse button that would open a menu', () => {
    component['onPointerDown'](pointer(1, 40, 60, 2));

    expect(component['origin']()).toBeNull();
  });

  it('keeps a resting finger at rest when the viewport moves under it', () => {
    down(1, 40, 60);
    // The browser chrome goes: the zone is 56px higher on the screen now.
    (fixture.nativeElement.getBoundingClientRect as jest.Mock).mockReturnValue({
      left: 100,
      top: 144,
      width: 160,
      height: 240,
    });

    component['onResize']();
    component['onPointerMove'](pointer(1, 40, 60 - 56));

    expect(steered).toEqual([{ x: 0, y: 0 }]);
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

  it('lets go of a held stick when it is destroyed', () => {
    down(1, 40, 60);
    move(1, 40 + RIM, 60);

    fixture.destroy();

    expect(steered.at(-1)).toEqual({ x: 0, y: 0 });
  });

  it('stays quiet when destroyed at rest', () => {
    fixture.destroy();

    expect(steered).toEqual([]);
  });

  it('ignores every touch while disabled', () => {
    fixture.componentRef.setInput('disabled', true);

    down(1, 40, 60);
    move(1, 40 + RIM, 60);

    expect(steered).toEqual([]);
    expect(component['origin']()).toBeNull();
  });
});
