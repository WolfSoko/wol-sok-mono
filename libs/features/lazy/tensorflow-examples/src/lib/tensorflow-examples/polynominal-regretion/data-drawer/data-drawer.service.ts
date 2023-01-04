import { Injectable } from '@angular/core';
import { Tensor } from '@tensorflow/tfjs';
import { default as embed, VisualizationSpec } from 'vega-embed';

@Injectable({ providedIn: 'root' })
export class DataDrawerService {
  async plotData(element: HTMLElement, data: { xs: Tensor; ys: Tensor }) {
    const xvals = await data.xs.data();
    const yvals = await data.ys.data();

    const values = Array.from(yvals).map((_y, i) => {
      return { x: xvals[i], y: yvals[i] };
    });

    const spec: VisualizationSpec = {
      width: 300,
      height: 300,
      data: { values: values },
      mark: { type: 'point', orient: 'vertical' },
      encoding: {
        x: { field: 'x', type: 'quantitative' },
        y: { field: 'y', type: 'quantitative' },
      },
    };
    return embed(element, spec, { actions: true });
  }

  async plotDataAndPredictions(container: HTMLElement, data: { xs: Tensor; ys: Tensor }, preds: Tensor) {
    const xvals = await data.xs.data();
    const yvals = await data.ys.data();
    const predVals = await preds.data();

    const values = Array.from(yvals).map((_y, i) => {
      return { x: xvals[i], y: yvals[i], pred: predVals[i] };
    });

    const spec: VisualizationSpec = {
      width: 300,
      height: 300,
      data: { values: values },
      layer: [
        {
          mark: { type: 'point', orient: 'vertical' },
          encoding: {
            x: { field: 'x', type: 'quantitative' },
            y: { field: 'y', type: 'quantitative' },
          },
        },
        {
          mark: { type: 'line', orient: 'vertical' },
          encoding: {
            x: { field: 'x', type: 'quantitative' },
            y: { field: 'pred', type: 'quantitative' },
            color: { value: 'tomato' },
          },
        },
      ],
    };
    return embed(container, spec, { actions: false });
  }

  renderCoefficients(container: { innerHTML: string }, coeff: { a: number; b: number; c: number; d: number }) {
    container.innerHTML = `<span>a=${coeff.a.toFixed(3)}, b=${coeff.b.toFixed(3)}, c=${coeff.c.toFixed(
      3
    )},  d=${coeff.d.toFixed(3)}</span>`;
  }
}
