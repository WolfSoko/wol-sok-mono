import { Injectable } from '@angular/core';
import {
  randomNormal,
  randomUniform,
  Rank,
  scalar,
  Tensor,
  tidy,
} from '@tensorflow/tfjs';

@Injectable({ providedIn: 'root' })
export class DataGeneratorService {
  generateData(
    numPoints: number,
    coeff: { a: number; b: number; c: number; d: number },
    sigma = 0.725
  ): { xs: Tensor<Rank.R0>; ys: Tensor<Rank.R0> } {
    return tidy(() => {
      const [a, b, c, d]: Tensor<Rank.R0>[] = [
        scalar(coeff.a),
        scalar(coeff.b),
        scalar(coeff.c),
        scalar(coeff.d),
      ];

      const xs: Tensor<Rank.R0> = randomUniform([numPoints], -1, 1);

      // Generate polynomial data
      const three = scalar(3, 'int32');
      const ys: Tensor<Rank.R0> = a
        .mul(xs.pow(three as Tensor))
        .add(b.mul(xs.square()))
        .add(c.mul(xs as Tensor))
        .add(d as Tensor)
        // Add random noise to the generated data
        // to make the problem a bit more interesting
        .add(randomNormal([numPoints], 0, sigma));

      // Normalize the y values to the range 0 to 1.
      const ymin = ys.min();
      const ymax = ys.max();
      const yrange = ymax.sub(ymin);
      const ysNormalized: Tensor<Rank.R0> = ys.sub(ymin).div(yrange);
      return {
        xs,
        ys: ysNormalized,
      };
    });
  }
}
