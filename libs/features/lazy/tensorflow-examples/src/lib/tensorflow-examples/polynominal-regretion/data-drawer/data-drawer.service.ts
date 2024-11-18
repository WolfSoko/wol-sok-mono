import { Injectable } from '@angular/core';
import { Tensor } from '@tensorflow/tfjs';
import { default as embed, VisualizationSpec } from 'vega-embed';

@Injectable({ providedIn: 'root' })
export class DataDrawerService {
  async plotData(
    element: HTMLElement | null,
    data: { xs: Tensor; ys: Tensor }
  ) {
    if (!element) {
      return;
    }
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

  async plotDataAndPredictions(
    container: HTMLElement | null,
    data: { xs: Tensor; ys: Tensor },
    preds: Tensor,
    predsNew?: Tensor | null
  ) {
    if (!container) {
      return;
    }

    const xVals = await data.xs.data();
    const yVals = await data.ys.data();
    const predVals = await preds.data();
    const predNewVals = await predsNew?.data();

    const values = Array.from(yVals).map((_y, i) => {
      return {
        x: xVals[i],
        y: yVals[i],
        pred: predVals[i],
        predNew: predNewVals?.[i],
      };
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
        {
          mark: {
            type: 'line',
            orient: 'vertical',
            text: 'old learned polynomial',
          },
          encoding: {
            x: { field: 'x', type: 'quantitative' },
            y: { field: 'predNew', type: 'quantitative' },
            color: { value: 'grey' },
          },
        },
      ],
    };
    return embed(container, spec, { actions: false });
  }
}
