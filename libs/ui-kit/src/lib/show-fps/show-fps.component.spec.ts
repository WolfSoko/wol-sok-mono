import { byText } from '@ngneat/spectator';
import { createHostFactory, SpectatorHost } from '@ngneat/spectator/jest';

import { ShowFpsComponent, ShowFpsModule } from './show-fps.component';

describe('ShowFpsComponent', () => {
  const createHost = createHostFactory({
    template: `<ws-shared-ui-show-fps [show]="true" [fps]="60"></ws-shared-ui-show-fps>`,
    component: ShowFpsComponent,
    imports: [ShowFpsModule],
  });

  it('should create', () => {
    const spectator = createHost();
    expect(spectator.queryHost(ShowFpsComponent)).toBeTruthy();
  });

  it('should show fps if show is true', () => {
    const spectator = createHost(
      `<ws-shared-ui-show-fps [show]="true" [fps]="40.1" ></ws-shared-ui-show-fps>`
    );
    expect(spectator.query(byText('40.1 FPS'))).toExist();
  });

  it('should not show fps if show is false', () => {
    const spectator = createHost(
      `<ws-shared-ui-show-fps [show]="false" [fps]="40.1" ></ws-shared-ui-show-fps>`
    );
    expect(spectator.query(byText('40.1 FPS'))).not.toExist();
  });

  it('should update fps when changes', () => {
    const spectator: SpectatorHost<ShowFpsComponent, { fps: number }> =
      createHost(
        `<ws-shared-ui-show-fps [show]="true" [fps]="fps" ></ws-shared-ui-show-fps>`,
        {
          hostProps: {
            fps: 40.1,
          },
        }
      );
    expect(spectator.query(byText('40.1 FPS'))).toExist();
    spectator.setHostInput('fps', 30.2);
    expect(spectator.query(byText('30.2 FPS'))).toExist();
  });

  it('should hide when show changes', () => {
    const spectator: SpectatorHost<ShowFpsComponent, { show: boolean }> =
      createHost(
        `<ws-shared-ui-show-fps [show]="show" [fps]="60" ></ws-shared-ui-show-fps>`,
        {
          hostProps: {
            show: true,
          },
        }
      );
    expect(spectator.query(byText('60 FPS'))).toBeTruthy();
    spectator.setHostInput('show', false);
    expect(spectator.query(byText('60 FPS'))).not.toExist();
  });
});
