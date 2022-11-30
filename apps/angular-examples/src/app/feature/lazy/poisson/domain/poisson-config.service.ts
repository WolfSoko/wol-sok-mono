import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { PoissonConfig } from './model/poisson.config';

const minRadius = 1;

const DEFAULT_CONFIG: PoissonConfig = {
  iterationsPerFrame : 10,
  r: 5,
  k : 15,
  w : minRadius / Math.sqrt(2)
};

@Injectable({ providedIn: 'root' })
export class PoissonConfigService {

  private config = new BehaviorSubject(DEFAULT_CONFIG);
  public config$ = this.config.asObservable();

  update(config: Partial<PoissonConfig>) {
    this.config.next({ ...this.config.value, ...config });
  }

}
