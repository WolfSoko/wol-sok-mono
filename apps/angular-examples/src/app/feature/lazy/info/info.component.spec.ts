import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterModule } from '@angular/router';
import { Subject } from 'rxjs';
import { InfoComponent } from './info.component';

describe('InfoComponent', () => {
  let component: InfoComponent;
  let fixture: ComponentFixture<InfoComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [InfoComponent, NoopAnimationsModule, RouterModule.forRoot([])],
    }).compileComponents();

    fixture = TestBed.createComponent(InfoComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    // Given: Component is initialized
    // When: Component is created
    // Then: Component should be truthy
    expect(component).toBeTruthy();
  });

  it('should display 9 technologies', () => {
    // Given: Component is initialized
    // When: Technologies signal is accessed
    const technologies = component.technologies();

    // Then: Should have exactly 9 technologies
    expect(technologies.length).toBe(9);
  });

  it('should have readonly technologies signal', () => {
    // Given: Component is initialized
    // When: Accessing technologies
    const technologies = component.technologies;

    // Then: Technologies should be a signal
    expect(technologies).toBeDefined();
    expect(typeof technologies).toBe('function');
  });

  it('should initialize with correct technology data', () => {
    // Given: Component is initialized
    // When: Getting all technologies
    const technologies = component.technologies();

    // Then: Technologies should include Angular, TypeScript, etc.
    const techTitles = technologies.map((t) => t.title);
    expect(techTitles).toContain('Angular+');
    expect(techTitles).toContain('Typescript');
    expect(techTitles).toContain('tensorflow.js');
    expect(techTitles).toContain('firebase');
  });

  it('should start demo on button click', () => {
    // Given: Component is initialized with demo not running
    expect(component.demoRunning()).toBe(false);

    // When: startDemo is called
    component.startDemo();

    // Then: demoRunning should be true
    expect(component.demoRunning()).toBe(true);
  });

  it('should stop demo when stopDemo is called', () => {
    // Given: Demo is running
    component.startDemo();
    expect(component.demoRunning()).toBe(true);

    // When: stopDemo is called
    component.stopDemo();

    // Then: demoRunning should be false
    expect(component.demoRunning()).toBe(false);
  });

  it('should toggle demo state', () => {
    // Given: Demo is not running
    const initialState = component.demoRunning();

    // When: toggleDemo is called
    component.toggleDemo();

    // Then: Demo state should be inverted
    expect(component.demoRunning()).toBe(!initialState);

    // When: toggleDemo is called again
    component.toggleDemo();

    // Then: Demo state should return to initial
    expect(component.demoRunning()).toBe(initialState);
  });

  it('should have thanosDemo input with default false', () => {
    // Given: Component is created
    // When: Checking thanosDemo input
    const thanosDemo = component.thanosDemo();

    // Then: Should default to false
    expect(thanosDemo).toBe(false);
  });

  it('should accept thanosDemo input', () => {
    // Given: Component is created
    // When: Setting thanosDemo input to true
    fixture.componentRef.setInput('thanosDemo', true);
    fixture.detectChanges();

    // Then: thanosDemo should be true
    expect(component.thanosDemo()).toBe(true);
  });

  it('should handle demo lifecycle with techCards', (done) => {
    // Given: Component has tech cards initialized
    // Mock techCards with vaporize method using async observable
    const mockVaporize$ = new Subject<any>();
    const mockTechCard = {
      vaporizeAndScrollIntoView: jest.fn().mockReturnValue(mockVaporize$.asObservable()),
    } as any;

    // Mock QueryList
    component.techCards = {
      toArray: () => [mockTechCard],
    } as any;

    // When: Starting demo
    component.startDemo();

    // Then: Demo should be running immediately after start
    expect(component.demoRunning()).toBe(true);

    // Simulate async vaporization completion
    setTimeout(() => {
      mockVaporize$.next({ state: 'completed' });
      mockVaporize$.complete();
      
      // Wait for completion handler to execute
      setTimeout(() => {
        // Then: Demo should stop after completion
        expect(component.demoRunning()).toBe(false);
        done();
      }, 10);
    }, 50);
  });

  it('should clean up on destroy', () => {
    // Given: Component is initialized
    // When: Component is destroyed
    fixture.destroy();

    // Then: Component should be destroyed without errors
    expect(fixture.componentInstance).toBeTruthy();
  });
});
