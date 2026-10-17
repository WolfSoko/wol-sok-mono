import P5 from 'p5';
import { BrainService } from '../brain.service';
import { heatmapColor } from '../data-view/data-p5-sketch';
import { Perceptron } from '../perceptron';

const positiveColor = [235, 140, 30];
const negativeColor = [60, 100, 230];
const tileResolution = 20;
const columnPadding = 40;
const rowGap = 14;
const minLineWidth = 0.5;
const maxLineWidth = 10;
const maxBorderWidth = 4;
const headerHeight = 24;

interface Node {
  x: number;
  y: number;
  size: number;
  label: string;
  perceptron?: Perceptron;
}

interface Edge {
  from: Node;
  to: Node;
  weight: number;
}

/**
 * Draws the whole net in one picture: a column per layer, every neuron as a tile
 * showing a heatmap of its own output over the data square, and every weight as a
 * line whose width grows with |weight| (orange positive, blue negative). A neuron's
 * bias is drawn the same way, as the width and colour of the tile border.
 */
export class NetworkP5Sketch {
  private images = new Map<Perceptron | string, P5.Image>();
  // the network the tiles were computed for, to skip recomputing them while nothing learns
  private imagesOf?: { layers: Perceptron[][]; learnedDataPoints: number };

  constructor(
    private p: P5,
    private width: number,
    private tileSize: number,
    private brainService: BrainService,
    private layers: () => Perceptron[][],
    private inputLabels = ['x', 'y']
  ) {
    p.setup = () => p.createCanvas(width, this.heightFor(this.layers()));
    p.draw = () => this.draw();
  }

  private heightFor(layers: Perceptron[][]): number {
    const maxNodes = Math.max(
      this.inputLabels.length,
      ...layers.map((layer) => layer.length)
    );
    return headerHeight + maxNodes * (this.tileSize + rowGap) + rowGap + 20;
  }

  private draw(): void {
    const layers = this.layers();
    const height = this.heightFor(layers);
    if (this.p.height !== height) {
      this.p.resizeCanvas(this.width, height);
    }
    this.updateImages(layers);

    const columns = this.layout(layers);
    const edges = this.edges(columns);
    const maxAbs = Math.max(
      1,
      ...edges.map((edge) => Math.abs(edge.weight)),
      ...layers.flat().map((perceptron) => Math.abs(perceptron.bias))
    );
    const lineWidth = (value: number, maxWidth = maxLineWidth) =>
      minLineWidth + (maxWidth - minLineWidth) * (Math.abs(value) / maxAbs);
    const showValues = edges.length <= 4;

    this.p.background(255);
    for (const edge of edges) {
      this.p.stroke(weightColor(edge.weight, 200));
      this.p.strokeWeight(lineWidth(edge.weight));
      this.p.line(
        edge.from.x + edge.from.size / 2,
        edge.from.y,
        edge.to.x - edge.to.size / 2,
        edge.to.y
      );
    }
    if (showValues) {
      edges.forEach((edge) => this.drawWeightLabel(edge));
    }
    this.drawHeaders(columns, layers.length);

    for (const node of columns.flat()) {
      const image = this.images.get(node.perceptron ?? node.label);
      const left = node.x - node.size / 2;
      const top = node.y - node.size / 2;
      if (image) {
        this.p.image(image, left, top, node.size, node.size);
      }
      this.p.noFill();
      if (node.perceptron) {
        // the bias border sits outside the tile, so it never covers the heatmap
        const border = lineWidth(node.perceptron.bias, maxBorderWidth);
        this.p.stroke(weightColor(node.perceptron.bias, 255));
        this.p.strokeWeight(border);
        this.p.rect(
          left - border / 2,
          top - border / 2,
          node.size + border,
          node.size + border,
          4
        );
        if (showValues) {
          this.p.noStroke();
          this.p.fill(0);
          this.p.textSize(12);
          this.p.textAlign(this.p.CENTER, this.p.TOP);
          this.p.text(
            `b = ${node.perceptron.bias.toFixed(2)}`,
            node.x,
            top + node.size + 6
          );
        }
      } else {
        this.p.stroke(120);
        this.p.strokeWeight(1);
        this.p.rect(left, top, node.size, node.size, 4);

        this.p.noStroke();
        this.p.fill(0);
        this.p.textAlign(this.p.RIGHT, this.p.CENTER);
        this.p.textSize(14);
        this.p.text(node.label, left - 6, node.y);
      }
    }

    this.drawHover(columns, edges);
  }

  private layout(layers: Perceptron[][]): Node[][] {
    const columnCount = layers.length + 1;
    const columnX = (column: number) =>
      columnPadding +
      this.tileSize / 2 +
      (column * (this.width - 2 * columnPadding - this.tileSize)) /
        Math.max(1, columnCount - 1);
    const column = (labels: string[], index: number, layer?: Perceptron[]) => {
      const top =
        headerHeight +
        (this.p.height -
          headerHeight -
          labels.length * (this.tileSize + rowGap)) /
          2 +
        rowGap / 2;
      return labels.map((label, row) => ({
        x: columnX(index),
        y: top + row * (this.tileSize + rowGap) + this.tileSize / 2,
        size: this.tileSize,
        label,
        perceptron: layer?.[row],
      }));
    };
    return [
      column(this.inputLabels, 0),
      ...layers.map((layer, l) =>
        column(
          layer.map((_, j) =>
            l === layers.length - 1 ? 'Output' : `Hidden ${l + 1}.${j + 1}`
          ),
          l + 1,
          layer
        )
      ),
    ];
  }

  private edges(columns: Node[][]): Edge[] {
    return columns.slice(1).flatMap((column, c) =>
      column.flatMap((to) =>
        columns[c].map((from, i) => ({
          from,
          to,
          weight: to.perceptron?.weights[i] ?? 0,
        }))
      )
    );
  }

  /** Renders, for every neuron, its output over the data square into a small image. */
  private updateImages(layers: Perceptron[][]): void {
    const { learnedDataPoints } = this.brainService;
    if (
      this.imagesOf?.layers === layers &&
      this.imagesOf.learnedDataPoints === learnedDataPoints
    ) {
      return;
    }
    this.imagesOf = { layers, learnedDataPoints };

    const keys: (Perceptron | string)[] = [
      ...this.inputLabels,
      ...layers.flat(),
    ];
    const images = keys.map((key) => {
      let image = this.images.get(key);
      if (!image) {
        image = this.p.createImage(tileResolution, tileResolution);
        this.images.set(key, image);
      }
      image.loadPixels();
      return image;
    });

    for (let y = 0; y < tileResolution; y++) {
      for (let x = 0; x < tileResolution; x++) {
        const input = [(x + 0.5) / tileResolution, (y + 0.5) / tileResolution];
        const outputs = [
          ...input,
          ...this.brainService.layerActivationsSilent(input).flat(),
        ];
        outputs.forEach((output, n) => {
          const [r, g, b] = heatmapColor(output);
          const i = (y * tileResolution + x) * 4;
          const pixels = images[n].pixels;
          pixels[i] = r;
          pixels[i + 1] = g;
          pixels[i + 2] = b;
          pixels[i + 3] = 255;
        });
      }
    }
    images.forEach((image) => image.updatePixels());
  }

  private drawHeaders(columns: Node[][], layerCount: number): void {
    this.p.noStroke();
    this.p.fill(60);
    this.p.textSize(13);
    this.p.textAlign(this.p.CENTER, this.p.TOP);
    columns.forEach((column, c) => {
      const title =
        c === 0
          ? 'Input'
          : c === layerCount
            ? 'Output'
            : `Hidden layer${layerCount > 2 ? ` ${c}` : ''}`;
      this.p.text(title, column[0].x, 6);
    });
  }

  private drawWeightLabel({ from, to, weight }: Edge): void {
    this.p.noStroke();
    this.p.fill(0);
    this.p.textSize(12);
    this.p.textAlign(this.p.CENTER, this.p.BOTTOM);
    this.p.text(
      `w = ${weight.toFixed(2)}`,
      (from.x + to.x) / 2,
      (from.y + to.y) / 2 - 6
    );
  }

  private drawHover(columns: Node[][], edges: Edge[]): void {
    const { mouseX, mouseY } = this.p;
    if (
      mouseX < 0 ||
      mouseY < 0 ||
      mouseX > this.width ||
      mouseY > this.p.height
    ) {
      return;
    }
    const node = columns
      .flat()
      .find(
        ({ x, y, size }) =>
          Math.abs(mouseX - x) <= size / 2 && Math.abs(mouseY - y) <= size / 2
      );
    let lines: string[] | undefined;
    if (node?.perceptron) {
      lines = [
        node.label,
        `bias = ${node.perceptron.bias.toFixed(3)}`,
        ...node.perceptron.weights.map(
          (weight, i) => `w${i + 1} = ${weight.toFixed(3)}`
        ),
      ];
    } else if (node) {
      lines = [`input ${node.label}`];
    } else {
      const edge = edges.find(
        ({ from, to }) =>
          distanceToSegment(
            mouseX,
            mouseY,
            from.x + from.size / 2,
            from.y,
            to.x - to.size / 2,
            to.y
          ) < 4
      );
      if (edge) {
        lines = [
          `${edge.from.label} → ${edge.to.label}`,
          `w = ${edge.weight.toFixed(3)}`,
        ];
      }
    }
    if (!lines) {
      return;
    }

    this.p.textSize(12);
    this.p.textAlign(this.p.LEFT, this.p.TOP);
    const boxWidth =
      Math.max(...lines.map((line) => this.p.textWidth(line))) + 12;
    const boxHeight = lines.length * 15 + 8;
    const left = Math.min(mouseX + 12, this.width - boxWidth - 2);
    const top = Math.min(mouseY + 12, this.p.height - boxHeight - 2);
    this.p.stroke(80);
    this.p.strokeWeight(1);
    this.p.fill(255, 255, 255, 235);
    this.p.rect(left, top, boxWidth, boxHeight, 4);
    this.p.noStroke();
    this.p.fill(0);
    lines.forEach((line, i) => this.p.text(line, left + 6, top + 4 + i * 15));
  }
}

function weightColor(weight: number, alpha: number): number[] {
  return [...(weight >= 0 ? positiveColor : negativeColor), alpha];
}

function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const t = Math.max(
    0,
    Math.min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy || 1))
  );
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
