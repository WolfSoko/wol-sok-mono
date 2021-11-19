import * as p5 from 'p5';
import { CellWeights } from './cell-weights';
import { merge, Observable, range, Subject, Subscription } from 'rxjs';
import { addChemicals, calcNextDiffStep } from './worker-calculation';
import { ReactionDiffCalcParams } from './reaction-diff-calc-params';
import { mapWorker, WorkerPostParams } from '../rx/operator/map-worker';
import { CalcNextParam } from './calc-next-param';
import { Cell } from './cell';
import { AddChemicalsParams } from './add-chemicals-param';
import { filter } from 'rxjs/operators';
import { ReactionDiffCalculator } from './reaction-diff-calculator';
import { ColorMapperService } from './color-mapper.service';

export class ReactionDiffWorkerCalcService implements ReactionDiffCalculator {



  public grid: Float32Array | null = null;
  public image!: HTMLImageElement;
  public numberThreads = 6;
  private calcRunning = 0;
  private weights!: CellWeights;
  private addChemicalRadius!: number;
  private workerSubjects$!: Subject<WorkerPostParams<CalcNextParam>>[];
  private workers$!: Observable<{ buffer: ArrayBufferLike; offsetRow: number }>[];
  private canCalculate = true;
  private addChemicalsSubject$!: Subject<WorkerPostParams<AddChemicalsParams>>;
  private calcParams!: ReactionDiffCalcParams;

  private workerSubscriptions: Subscription = new Subscription();

  private static setCell(column: number, row: number, cell: Cell, width: number, arrayToSet: Float32Array): void {
    const index = (column + row * width) * 2;
    arrayToSet[index] = cell.a;
    arrayToSet[index + 1] = cell.b;
  }

  private static getCell(column: number, row: number, width: number, arrayToGet: Float32Array): Cell {
    const index = (column + row * width) * 2;
    return {
      a: arrayToGet[index], b: arrayToGet[index + 1]
    };
  }

  constructor(private width: number,
              private height: number,
              calcParams$: Observable<ReactionDiffCalcParams>,
              weightParams$: Observable<CellWeights>,
              addChemicalRadius$: Observable<number>, private colorMapper: ColorMapperService) {
    calcParams$.subscribe((calcParams) => this.setCalcParams(calcParams));
    weightParams$.subscribe((weights) => this.setWeights(weights));
    addChemicalRadius$.subscribe((radius) => this.addChemicalRadius = radius);
    this.init();
  }

  public resize(newWidth: number, newHeight: number) {
    this.canCalculate = false;
    this.grid = this.adjustGridLength(newWidth, newHeight);
    this.width = newWidth;
    this.height = newHeight;
    this.canCalculate = true;
  }

  public calcNext() {
    if (this.calcRunning > 0 || !this.canCalculate) {
      return;
    }

    const offsetLength = Math.round(this.height / this.numberThreads);
    let offsetRow = 0;
    performance.mark('calcNext-start');
    for (let i = 0; i < this.numberThreads; i++) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const view = new Float32Array(this.grid!);
      const offsetLengthAdjusted = (offsetRow + offsetLength) > this.height ? this.height - offsetRow : offsetLength;

      this.workerSubjects$[i].next({
        data: {
          width: this.width,
          height: this.height,
          gridBuffer: view.buffer,
          dA: this.calcParams.diffRateA,
          dB: this.calcParams.diffRateB,
          f: this.calcParams.feedRate,
          k: this.calcParams.killRate,
          dynamicKillFeed: this.calcParams.dynamicKillFeed,
          w: this.weights,
          offsetRow: offsetRow,
          offsetLength: offsetLengthAdjusted
        }, transferList: [view.buffer]
      });
      this.calcRunning++;
      offsetRow = offsetRow + offsetLength;
    }
  }

  addChemical(x: number, y: number): void {
    if(!this.grid){
      return;
    }
    this.canCalculate = false;
    const r = this.addChemicalRadius;
    const gridCopy = new Float32Array(this.grid);
    const data: AddChemicalsParams = { x, y, r, width: this.width, height: this.height, gridBuffer: gridCopy.buffer };
    const workerParams: WorkerPostParams<AddChemicalsParams> = { data: data, transferList: [gridCopy.buffer] };
    this.addChemicalsSubject$.next(workerParams);
  }

  public reset(): void {
    this.workerSubjects$.forEach(sub => sub.complete());
    this.init();
  }

  updateNumberThreads(numberWebWorkers: number): void {
    this.numberThreads = numberWebWorkers;
    this.workerSubjects$.forEach(sub => sub.complete());
    this.initCalcWorkers$();
  }

  drawImage(graphics: p5): void {
    if(!this.grid){
      return;
    }
    graphics.loadPixels();
    for (let x = 0; x < this.grid.length - 1; x = x + 2) {
      const pix = (x * 2);
      const cellColor = this.colorMapper.calcColorFor({ a: this.grid[x], b: this.grid[x + 1] }, graphics);
      graphics.pixels[pix] = cellColor.r;
      graphics.pixels[pix + 1] = cellColor.b;
      graphics.pixels[pix + 2] = cellColor.g;
      graphics.pixels[pix + 3] = 255;
    }
    graphics.updatePixels();
  }

  cleanup(): void {
    this.workerSubscriptions?.unsubscribe();
    this.canCalculate = false;
    this.grid = null;
  }

  private setWeights(weights: CellWeights) {
    this.weights = Object.assign({}, weights);
  }

  private setCalcParams(calcParams: ReactionDiffCalcParams) {
    this.calcParams = calcParams;
  }

  private init() {
    // this.gridBuffer = new ArrayBuffer(this.width * this.height * 2);
    this.grid = new Float32Array(this.width * this.height * 2);

    for (let x = 0; x < this.width; x++) {
      for (let y = 0; y < this.height; y++) {
        ReactionDiffWorkerCalcService.setCell(x, y, { a: 1, b: 0 }, this.width, this.grid);
      }
    }

    this.initCalcWorkers$();
    this.initAddChemicals$();
    this.addChemical(Math.floor(this.width / 2), Math.floor(this.height / 2));
  }

  private initCalcWorkers$() {
    this.workerSubjects$ = [];
    range(0, this.numberThreads)
      .subscribe((index) => this.workerSubjects$[index] = new Subject<WorkerPostParams<CalcNextParam>>());

    this.workers$ = this.workerSubjects$
      .map(subject =>
        subject.pipe(
          filter(value => (this.calcRunning < this.numberThreads) && this.canCalculate),
          mapWorker(calcNextDiffStep)
        )
      );

    this.workerSubscriptions.add(merge(...this.workers$)
      .subscribe(
      (data) => this.receiveChunk(data),
      error => console.error(error)
    ));

    this.calcRunning = 0;
  }

  private adjustGridLength(newWidth: number, newHeight: number): Float32Array {

    const adjustedGrid = new Float32Array(newHeight * newWidth * 2);

    const differenceHeight = this.height - newHeight;
    const offsetHeight = Math.floor(differenceHeight / 2);
    const differenceWidth = this.width - newWidth;
    const offsetWidth = Math.floor(differenceWidth / 2);

    for (let x = 0; x < newWidth; x++) {
      for (let y = 0; y < newHeight; y++) {
        if ((x >= offsetWidth && (offsetWidth + x) < this.width) || (y >= offsetHeight && y + offsetHeight < this.height)) {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          const cell = ReactionDiffWorkerCalcService.getCell(x - offsetWidth, y - offsetHeight, this.width, this.grid!);
          ReactionDiffWorkerCalcService.setCell(x, y, cell, newWidth, adjustedGrid);
          continue;
        }
        ReactionDiffWorkerCalcService.setCell(x, y, { a: 1, b: 0 }, newWidth, adjustedGrid);
      }
    }
    return adjustedGrid;
  }

  private receiveChunk(data: { buffer: ArrayBufferLike, offsetRow: number }) {
    this.calcRunning--;
    if (!this.canCalculate) {
      return;
    }
    const chunk = new Float32Array(data.buffer);
    if (this.grid) {
      this.grid.set(chunk, data.offsetRow * this.width * 2);
    }
    if (this.calcRunning === 0) {
      performance.mark('calcNext-end');
      performance.measure('calcNext', 'calcNext-start', 'calcNext-end');
    }
  }

  private initAddChemicals$(): void {
    this.addChemicalsSubject$ = new Subject<WorkerPostParams<AddChemicalsParams>>();
    this.addChemicalsSubject$.pipe(
      mapWorker(addChemicals)
    )
      .subscribe((gridBuffer: ArrayBufferLike) => {
        this.grid = new Float32Array(gridBuffer);
        this.canCalculate = true;
      });
  }
}

