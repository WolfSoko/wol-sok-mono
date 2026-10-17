import P5 from 'p5';
import { BrainService } from '../brain.service';
import { heatmapColor, setPixel } from '../heatmap';
import { Perceptron } from '../perceptron';

const inputLabels = ['x', 'y'];
const positiveLine = [235, 140, 30, 200];
const negativeLine = [60, 100, 230, 200];
const positiveBorder = [235, 140, 30];
const negativeBorder = [60, 100, 230];
const tileResolution = 20;
const columnPadding = 40;
const rowGap = 14;
const headerHeight = 24;
const minLineWidth = 0.5;
const maxLineWidth = 10;
const maxBorderWidth = 4;

interface NetworkNode {
  x: number;
  y: number;
  label: string;
  perceptron?: Perceptron;
}

interface Column {
  x: number;
  title: string;
  nodes: NetworkNode[];
}

interface Edge {
  from: NetworkNode;
  to: NetworkNode;
  weight: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Everything drawn from one state of the network; rebuilt only when the network changes. */
interface Scene {
  layers: Perceptron[][];
  learnedDataPoints: number;
  columns: Column[];
  nodes: NetworkNode[];
  edges: Edge[];
  maxAbs: number;
  // one tile per node, in the order of `nodes`
  tiles: P5.Image[];
}

/**
 * Draws the whole net in one picture: a column per layer, every neuron as a tile
 * showing a heatmap of its own output over the data square, and every weight as a
 * line whose width grows with |weight| (orange positive, blue negative). A neuron's
 * bias is drawn the same way, as the width and colour of the tile border.
 */
export class NetworkP5Sketch {
  private scene?: Scene;

  constructor(
    private p: P5,
    private width: number,
    private tileSize: number,
    private showValues: boolean,
    private brainService: BrainService
  ) {
    p.setup = () =>
      p.createCanvas(width, this.heightFor(brainService.perceptrons));
    p.draw = () => this.draw();
  }

  private heightFor(layers: Perceptron[][]): number {
    const maxNodes = Math.max(
      inputLabels.length,
      ...layers.map((layer) => layer.length)
    );
    return headerHeight + maxNodes * (this.tileSize + rowGap) + rowGap + 20;
  }

  private draw(): void {
    const scene = this.updateScene();
    const half = this.tileSize / 2;

    this.p.background(255);
    for (const edge of scene.edges) {
      this.p.stroke(edge.weight >= 0 ? positiveLine : negativeLine);
      this.p.strokeWeight(this.lineWidth(edge.weight, maxLineWidth));
      this.p.line(edge.x1, edge.y1, edge.x2, edge.y2);
    }
    if (this.showValues) {
      scene.edges.forEach((edge) => this.drawWeightLabel(edge));
    }
    this.drawHeaders(scene.columns);

    scene.nodes.forEach((node, n) => {
      const left = node.x - half;
      const top = node.y - half;
      this.p.image(scene.tiles[n], left, top, this.tileSize, this.tileSize);
      this.p.noFill();
      if (node.perceptron) {
        this.drawBiasBorder(node.perceptron.bias, left, top);
      } else {
        this.p.stroke(120);
        this.p.strokeWeight(1);
        this.p.rect(left, top, this.tileSize, this.tileSize, 4);
        this.p.noStroke();
        this.p.fill(0);
        this.p.textAlign(this.p.RIGHT, this.p.CENTER);
        this.p.textSize(14);
        this.p.text(node.label, left - 6, node.y);
      }
    });

    this.drawHover(scene);
  }

  private lineWidth(value: number, maxWidth: number): number {
    const maxAbs = this.scene?.maxAbs ?? 1;
    return (
      minLineWidth + (maxWidth - minLineWidth) * (Math.abs(value) / maxAbs)
    );
  }

  /** The bias border sits outside the tile, so it never covers the heatmap. */
  private drawBiasBorder(bias: number, left: number, top: number): void {
    const border = this.lineWidth(bias, maxBorderWidth);
    this.p.stroke(bias >= 0 ? positiveBorder : negativeBorder);
    this.p.strokeWeight(border);
    this.p.rect(
      left - border / 2,
      top - border / 2,
      this.tileSize + border,
      this.tileSize + border,
      4
    );
    if (this.showValues) {
      this.p.noStroke();
      this.p.fill(0);
      this.p.textSize(12);
      this.p.textAlign(this.p.CENTER, this.p.TOP);
      this.p.text(
        `b = ${bias.toFixed(2)}`,
        left + this.tileSize / 2,
        top + this.tileSize + 6
      );
    }
  }

  private updateScene(): Scene {
    const layers = this.brainService.perceptrons;
    const { learnedDataPoints } = this.brainService;
    if (
      this.scene?.layers === layers &&
      this.scene.learnedDataPoints === learnedDataPoints
    ) {
      return this.scene;
    }

    const height = this.heightFor(layers);
    if (this.p.height !== height) {
      this.p.resizeCanvas(this.width, height);
    }
    const columns = this.layout(layers);
    const nodes = columns.flatMap((column) => column.nodes);
    const edges = this.edges(columns);
    const tiles =
      this.scene?.layers === layers
        ? this.scene.tiles
        : nodes.map(() => this.p.createImage(tileResolution, tileResolution));
    this.renderTiles(tiles);

    this.scene = {
      layers,
      learnedDataPoints,
      columns,
      nodes,
      edges,
      maxAbs: Math.max(
        1,
        ...edges.map((edge) => Math.abs(edge.weight)),
        ...layers.flat().map((perceptron) => Math.abs(perceptron.bias))
      ),
      tiles,
    };
    return this.scene;
  }

  private layout(layers: Perceptron[][]): Column[] {
    const columnCount = layers.length + 1;
    const columnX = (column: number) =>
      columnPadding +
      this.tileSize / 2 +
      (column * (this.width - 2 * columnPadding - this.tileSize)) /
        Math.max(1, columnCount - 1);
    const column = (
      index: number,
      title: string,
      labels: string[],
      layer?: Perceptron[]
    ): Column => {
      const x = columnX(index);
      const top =
        headerHeight +
        (this.p.height -
          headerHeight -
          labels.length * (this.tileSize + rowGap)) /
          2 +
        rowGap / 2;
      return {
        x,
        title,
        nodes: labels.map((label, row) => ({
          x,
          y: top + row * (this.tileSize + rowGap) + this.tileSize / 2,
          label,
          perceptron: layer?.[row],
        })),
      };
    };
    const hiddenTitle = (l: number) =>
      layers.length > 2 ? `Hidden layer ${l + 1}` : 'Hidden layer';
    return [
      column(0, 'Input', inputLabels),
      ...layers.map((layer, l) => {
        const isOutput = l === layers.length - 1;
        const title = isOutput ? 'Output' : hiddenTitle(l);
        return column(
          l + 1,
          title,
          layer.map((_, j) =>
            isOutput && layer.length === 1 ? title : `${title}, neuron ${j + 1}`
          ),
          layer
        );
      }),
    ];
  }

  private edges(columns: Column[]): Edge[] {
    const half = this.tileSize / 2;
    return columns.slice(1).flatMap((column, c) =>
      column.nodes.flatMap((to) =>
        columns[c].nodes.map((from, i) => ({
          from,
          to,
          weight: to.perceptron?.weights[i] ?? 0,
          x1: from.x + half,
          y1: from.y,
          x2: to.x - half,
          y2: to.y,
        }))
      )
    );
  }

  /** Renders, for every node, its output over the data square into its tile. */
  private renderTiles(tiles: P5.Image[]): void {
    tiles.forEach((tile) => tile.loadPixels());
    for (let y = 0; y < tileResolution; y++) {
      for (let x = 0; x < tileResolution; x++) {
        const input = [(x + 0.5) / tileResolution, (y + 0.5) / tileResolution];
        const outputs = [
          ...input,
          ...this.brainService.layerActivationsSilent(input).flat(),
        ];
        outputs.forEach((output, n) =>
          setPixel(
            tiles[n].pixels,
            y * tileResolution + x,
            heatmapColor(output)
          )
        );
      }
    }
    tiles.forEach((tile) => tile.updatePixels());
  }

  private drawHeaders(columns: Column[]): void {
    this.p.noStroke();
    this.p.fill(60);
    this.p.textSize(13);
    this.p.textAlign(this.p.CENTER, this.p.TOP);
    columns.forEach(({ x, title }) => this.p.text(title, x, 6));
  }

  private drawWeightLabel({ x1, y1, x2, y2, weight }: Edge): void {
    this.p.noStroke();
    this.p.fill(0);
    this.p.textSize(12);
    this.p.textAlign(this.p.CENTER, this.p.BOTTOM);
    this.p.text(`w = ${weight.toFixed(2)}`, (x1 + x2) / 2, (y1 + y2) / 2 - 6);
  }

  private drawHover({ nodes, edges }: Scene): void {
    const { mouseX, mouseY } = this.p;
    if (
      mouseX < 0 ||
      mouseY < 0 ||
      mouseX > this.width ||
      mouseY > this.p.height
    ) {
      return;
    }
    const half = this.tileSize / 2;
    const node = nodes.find(
      ({ x, y }) => Math.abs(mouseX - x) <= half && Math.abs(mouseY - y) <= half
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
        ({ x1, y1, x2, y2 }) =>
          distanceToSegment(mouseX, mouseY, x1, y1, x2, y2) < 4
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
