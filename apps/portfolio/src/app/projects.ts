/** A link of a project: where it runs, its store page, its source. */
export interface ProjectLink {
  label: string;
  url: string;
}

export interface Project {
  name: string;
  tagline: string;
  description: string;
  /** Accent colour of the card, as a CSS colour. */
  accent: string;
  tech: string[];
  links: ProjectLink[];
}

const SOURCE = 'https://github.com/WolfSoko/wol-sok-mono/tree/main';
const EXAMPLES = 'https://angularexamples.wolsok.de';

/** Apps that stand on their own, each on its own domain. */
export const APPS: Project[] = [
  {
    name: 'Bacteria Wars',
    tagline: 'Two colonies, one petri dish.',
    description:
      'A real-time strategy game on the GPU: steer your colony, grow across the dish and swallow the other one. Against the computer, with a friend on one screen or online between two devices. Runs in the browser, installs as an app and is on Google Play.',
    accent: '#ff7a1a',
    tech: ['Angular', 'WebGL', 'Firebase', 'PWA', 'Android TWA'],
    links: [
      { label: 'Play', url: 'https://bacteria-wars.wolsok.de/' },
      {
        label: 'Google Play',
        url: 'https://play.google.com/store/apps/details?id=de.wolsok.bacteriawars',
      },
      { label: 'Source', url: `${SOURCE}/apps/bacteria-game-remote` },
    ],
  },
  {
    name: 'Movepath',
    tagline: 'Track your push-ups, keep your streak.',
    description:
      'A training log for push-ups and more: daily goals, streaks, statistics and reminders, with an AI coach. Server-side rendered and available as an Android app.',
    accent: '#22c55e',
    tech: ['Angular SSR', 'Firebase', 'Gemini', 'Android TWA'],
    links: [
      { label: 'Open', url: 'https://movepath.app/' },
      {
        label: 'Google Play',
        url: 'https://play.google.com/store/apps/details?id=com.pushupstats.app',
      },
    ],
  },
  {
    name: 'Pacetrainer',
    tagline: 'Hit your running pace.',
    description:
      'Plan and train running paces: convert between pace and speed, plan intervals and keep the rhythm on the track.',
    accent: '#38bdf8',
    tech: ['Analog.js', 'Angular', 'Firebase'],
    links: [
      { label: 'Open', url: 'https://pace-trainer.com/' },
      { label: 'Source', url: `${SOURCE}/apps/pacetrainer` },
    ],
  },
  {
    name: 'RollaPolla',
    tagline: 'Ask, share, see the result roll in.',
    description:
      'Polls in seconds: create one, share the link, watch the votes arrive live. Server-side rendered for fast first loads and good share previews.',
    accent: '#e879f9',
    tech: ['Analog.js', 'SSR', 'tRPC', 'Firebase'],
    links: [
      { label: 'Open', url: 'https://rollapolla.com/' },
      { label: 'Source', url: `${SOURCE}/apps/rollapolla-analog` },
    ],
  },
  {
    name: 'Angular Examples',
    tagline: 'The lab: wild experiments in Angular.',
    description:
      'The showcase all the experiments below live in: a Native Federation shell that loads independently deployed remotes, zoneless and signal-based.',
    accent: '#f43f5e',
    tech: ['Angular', 'Native Federation', 'Signals', 'AWS CDK'],
    links: [
      { label: 'Open', url: `${EXAMPLES}/` },
      { label: 'Source', url: `${SOURCE}/apps/angular-examples` },
    ],
  },
];

/** Experiments inside Angular Examples, linked to their page there. */
export const EXPERIMENTS: Project[] = [
  {
    name: 'Fourier Analysis',
    tagline: 'See the frequencies in a sound.',
    description:
      'Wrap a signal wave or your own microphone recording around a circle and watch its frequencies appear.',
    accent: '#facc15',
    tech: ['Web Audio', 'Canvas'],
    links: [{ label: 'Try it', url: `${EXAMPLES}/fourierAnalysis` }],
  },
  {
    name: 'Shader Playground',
    tagline: 'GLSL with a live editor.',
    description:
      'Write and tweak fragment shaders in a code editor and see the result instantly, rendered with three.js.',
    accent: '#a78bfa',
    tech: ['GLSL', 'three.js'],
    links: [{ label: 'Try it', url: `${EXAMPLES}/shaderExamples` }],
  },
  {
    name: 'Mandelbrot Deep Zoom',
    tagline: 'Dive into the fractal.',
    description:
      'A real-time deep zoom renderer for the Mandelbrot set, running on WebGL shaders.',
    accent: '#2dd4bf',
    tech: ['WebGL', 'three.js'],
    links: [{ label: 'Try it', url: `${EXAMPLES}/webGl` }],
  },
  {
    name: 'Reaction Diffusion',
    tagline: 'Turing patterns, grown on the GPU.',
    description:
      'A Gray-Scott simulation in gpu.js: draw into the canvas and watch organic patterns grow.',
    accent: '#fb923c',
    tech: ['gpu.js'],
    links: [{ label: 'Try it', url: `${EXAMPLES}/reactionDiff` }],
  },
  {
    name: 'Digit Recognition',
    tagline: 'A neural network reads your handwriting.',
    description:
      'Draw a digit and a deep network trained on MNIST recognises it, right in the browser.',
    accent: '#60a5fa',
    tech: ['TensorFlow.js'],
    links: [{ label: 'Try it', url: `${EXAMPLES}/tensorflowExamples` }],
  },
  {
    name: 'Neural Networks',
    tagline: 'Watch a perceptron learn.',
    description:
      'A perceptron and a small network learning in real time, with their training data drawn in p5.js.',
    accent: '#f472b6',
    tech: ['p5.js'],
    links: [{ label: 'Try it', url: `${EXAMPLES}/neuralNetwork` }],
  },
  {
    name: 'Gravity World',
    tagline: 'Build your own solar system.',
    description:
      'Add planets around a sun and watch the orbits form in a little gravity simulation.',
    accent: '#fbbf24',
    tech: ['Canvas', 'Physics'],
    links: [{ label: 'Try it', url: `${EXAMPLES}/gravityWorld` }],
  },
  {
    name: 'Poisson Disk Sampling',
    tagline: 'Random, but evenly spread.',
    description:
      'Evenly distributed random points, generated step by step from a seed you click.',
    accent: '#4ade80',
    tech: ['Algorithms', 'Canvas'],
    links: [{ label: 'Try it', url: `${EXAMPLES}/poisson` }],
  },
  {
    name: 'GPU vs CPU',
    tagline: 'Same picture, two speeds.',
    description:
      'GPU-accelerated rendering with gpu.js and no shader code: toggle between GPU and CPU and compare the frame rate.',
    accent: '#c084fc',
    tech: ['gpu.js'],
    links: [{ label: 'Try it', url: `${EXAMPLES}/someGpuCalculations` }],
  },
  {
    name: 'Fibonacci in WebAssembly',
    tagline: 'JavaScript against Wasm.',
    description:
      'The same Fibonacci calculation in plain JavaScript and in AssemblyScript compiled to WebAssembly, side by side.',
    accent: '#818cf8',
    tech: ['WebAssembly', 'AssemblyScript'],
    links: [{ label: 'Try it', url: `${EXAMPLES}/webassemblyTests` }],
  },
];

/** Packages published on npm. */
export const PACKAGES: Project[] = [
  {
    name: '@wolsok/thanos',
    tagline: 'Snap your fingers, vaporize the DOM.',
    description:
      'An Angular directive that dissolves any element into tiny particles, Thanos style.',
    accent: '#a855f7',
    tech: ['Angular', 'Canvas'],
    links: [
      { label: 'npm', url: 'https://www.npmjs.com/package/@wolsok/thanos' },
      { label: 'Demo', url: `${EXAMPLES}/home?thanosDemo=true` },
      { label: 'Source', url: `${SOURCE}/libs/public/ws-thanos` },
    ],
  },
  {
    name: '@wolsok/nx-aws-cdk-v2',
    tagline: 'AWS CDK v2 inside Nx.',
    description:
      'An Nx plugin to generate, synthesize, deploy and destroy AWS CDK v2 apps. It deploys every AWS stack of this site.',
    accent: '#f59e0b',
    tech: ['Nx', 'AWS CDK'],
    links: [
      {
        label: 'npm',
        url: 'https://www.npmjs.com/package/@wolsok/nx-aws-cdk-v2',
      },
      { label: 'Source', url: `${SOURCE}/libs/public/nx-aws-cdk-v2` },
    ],
  },
];
