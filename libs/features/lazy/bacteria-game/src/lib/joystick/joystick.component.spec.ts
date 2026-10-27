import { I18nService } from '../i18n/i18n.service';
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

  it('keeps the knob under a finger inside the rim', () => {
    down(1, 40, 60);

    move(1, 40 + 20, 60 - 10);

    expect(component['knob']()).toEqual({ x: 20, y: -10 });
  });

  it('steers towards where the finger is dragged', () => {
    down(1, 40, 60);

    move(1, 40 + RIM, 60);

    expect(steered).toEqual([{ x: 1, y: 0 }]);
    expect(component['knob']()).toEqual({ x: RIM, y: 0 });
  });

  it('drags the base along behind a finger pulled past the rim', () => {
    down(1, 40, 60);

    move(1, 40 + RIM + 30, 60);

    expect(component['origin']()).toEqual({ x: 70, y: 60 });
    expect(component['knob']()).toEqual({ x: RIM, y: 0 });
    expect(steered).toEqual([{ x: 1, y: 0 }]);
  });

  it('turns at once once the base followed the finger', () => {
    down(1, 40, 60);
    move(1, 40 + RIM + 30, 60);

    // Back by one radius: the knob sits in the middle of the moved base.
    move(1, 40 + 30, 60);

    expect(component['knob']()).toEqual({ x: 0, y: 0 });
    expect(steered.at(-1)).toEqual({ x: 0, y: 0 });
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

  it('names the player in German', () => {
    TestBed.inject(I18nService).setLanguage('de');
    fixture.componentRef.setInput('label', 'Blue');
    fixture.detectChanges();

    expect(fixture.nativeElement.getAttribute('aria-label')).toBe(
      'Joystick Blau'
    );
  });
});
