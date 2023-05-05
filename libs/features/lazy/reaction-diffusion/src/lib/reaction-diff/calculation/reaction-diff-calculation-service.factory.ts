import { Injectable } from '@angular/core';
import { GpuAdapterService } from '@wolsok/utils-gpu-calc';
import { ColorMapperService } from './color-mapper.service';
import { ReactionDiffCalculator } from './reaction-diff-calculator';
import { ReactionDiffConfigService } from '../reaction-diff-config.service';
import { ReactionDiffGpuCalcService } from './reaction-diff-gpu-calc.service';
import { ReactionDiffWorkerCalcService } from './reaction-diff-worker-calc.service';

@Injectable({ providedIn: 'root' })
export class ReactionDiffCalcServiceFactory {
  private lastCalcService?: ReactionDiffCalculator;

  constructor(
    private configService: ReactionDiffConfigService,
    private gpuJsService: GpuAdapterService,
    private colorMapper: ColorMapperService
  ) {}

  public createCalcService(width: number, height: number, useGpuJs = true) {
    if (useGpuJs) {
      this.lastCalcService = new ReactionDiffGpuCalcService(
        width,
        height,
        this.configService.calcParams$,
        this.configService.calcCellWeights$,
        this.configService.addChemicalRadius$,
        this.configService.speed$,
        this.gpuJsService
      );
    } else {
      this.lastCalcService = new ReactionDiffWorkerCalcService(
        width,
        height,
        this.configService.calcParams$,
        this.configService.calcCellWeights$,
        this.configService.addChemicalRadius$,
        this.colorMapper
      );
    }
    return this.lastCalcService;
  }
}
