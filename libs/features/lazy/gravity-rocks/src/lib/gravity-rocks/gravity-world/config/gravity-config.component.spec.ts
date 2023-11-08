/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { createHostFactory, SpectatorHost } from '@ngneat/spectator/jest';
import { qaSelector } from '@wolsok/test-helper';
import { GravityWorldConfig } from '../domain/gravity-world-config';
import { GravityConfigComponent } from './gravity-config.component';

describe('GravityConfigComponent', () => {
  const createHost = createHostFactory(GravityConfigComponent);

  let spectator: SpectatorHost<GravityConfigComponent>;
  let initialConfig: GravityWorldConfig;
  let configChangedMock: jest.Mock<void, [GravityWorldConfig]>;

  function createComp(): void {
    spectator = createHost(
      `<feat-lazy-gravity-config [config]="initialConfig" (configChange)="configChangedMock($event)"/>`,
      {
        hostProps: { initialConfig, configChangedMock },
      }
    );
  }

  beforeEach(async () => {
    initialConfig = {
      gravitationalConstant: 10,
      massOfSun: 10000,
    };

    configChangedMock = jest.fn();
  });

  it('should create', () => {
    createComp();
    expect(spectator.component).toBeTruthy();
  });

  it('should have a form', () => {
    createComp();
    expect(spectator.query(qaSelector('form'))).toBeTruthy();
  });

  it('should have a gravitational constant input', () => {
    createComp();
    expect(spectator.query(qaSelector('gConstant'))).toBeTruthy();
  });

  it('should have a mass of sun input', () => {
    createComp();
    expect(spectator.query(qaSelector('massOfSun'))).toBeTruthy();
  });

  it('should set the initial config as form values', () => {
    createComp();
    expect(spectator.component.form.getRawValue()).toEqual(initialConfig);
  });

  it('should show the initial config in the inputs', () => {
    createComp();
    expect(getGInput()?.value).toEqual('' + initialConfig.gravitationalConstant);
    expect(getMassOfSunInput()?.value).toEqual('' + initialConfig.massOfSun);
  });

  it('should change the inputs when initial config changes', () => {
    createComp();
    spectator.setHostInput({ initialConfig: { gravitationalConstant: 20, massOfSun: 20000 } });
    expect(getGInput()?.value).toEqual('20');
    expect(getMassOfSunInput()?.value).toEqual('20000');
  });

  it('should emit the initial config', () => {
    createComp();
    expect(configChangedMock).toHaveBeenCalledWith(initialConfig);
  });

  it('should emit when input "G" is changed', () => {
    createComp();
    const input = getGInput();
    spectator.typeInElement('20', input);
    expect(configChangedMock).toHaveBeenCalledWith({ ...initialConfig, gravitationalConstant: 20 });
  });

  it('should emit when input "massOfSun" is changed config', () => {
    createComp();
    const input = getMassOfSunInput();
    spectator.typeInElement('20000000', input);
    expect(configChangedMock).toHaveBeenCalledWith({ ...initialConfig, massOfSun: 20000000 });
  });

  it('should only emit if the value has changed', () => {
    createComp();
    const input = getGInput();
    spectator.typeInElement('10', input);
    expect(configChangedMock).toHaveBeenCalledTimes(1);
  });

  function getGInput(): HTMLInputElement {
    return spectator.query<HTMLInputElement>(qaSelector('gConstant'))!;
  }

  function getMassOfSunInput(): HTMLInputElement {
    return spectator.query<HTMLInputElement>(qaSelector('massOfSun'))!;
  }
});
