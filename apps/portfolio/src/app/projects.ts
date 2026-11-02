import { Localized } from './i18n/language';

/** A link of a project: where it runs, its store page, its source. */
export interface ProjectLink {
  label: string;
  url: string;
}

export interface Project {
  name: string;
  tagline: Localized;
  description: Localized;
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
    tagline: {
      en: 'Two colonies, one petri dish.',
      de: 'Zwei Kolonien, eine Petrischale.',
    },
    description: {
      en: 'A real-time strategy game on the GPU: steer your colony, grow across the dish and swallow the other one. Against the computer, with a friend on one screen or online between two devices. Runs in the browser, installs as an app and is on Google Play.',
      de: 'Ein Echtzeit-Strategiespiel auf der GPU: Steuere deine Kolonie, wachse über die Schale und verschlinge die andere. Gegen den Computer, mit einem Freund an einem Bildschirm oder online zwischen zwei Geräten. Läuft im Browser, installiert sich als App und ist bei Google Play.',
    },
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
    tagline: {
      en: 'Track your push-ups, keep your streak.',
      de: 'Zähle deine Liegestütze, halte deine Serie.',
    },
    description: {
      en: 'A training log for push-ups and more: daily goals, streaks, statistics and reminders, with an AI coach. Server-side rendered and available as an Android app.',
      de: 'Ein Trainingstagebuch für Liegestütze und mehr: Tagesziele, Serien, Statistiken und Erinnerungen, mit einem KI-Coach. Serverseitig gerendert und als Android-App erhältlich.',
    },
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
    tagline: {
      en: 'Hit your running pace.',
      de: 'Triff dein Lauftempo.',
    },
    description: {
      en: 'Plan and train running paces: convert between pace and speed, plan intervals and keep the rhythm on the track.',
      de: 'Lauftempo planen und trainieren: zwischen Pace und Geschwindigkeit umrechnen, Intervalle planen und auf der Bahn im Rhythmus bleiben.',
    },
    accent: '#38bdf8',
    tech: ['Analog.js', 'Angular', 'Firebase'],
    links: [
      { label: 'Open', url: 'https://pace-trainer.com/' },
      { label: 'Source', url: `${SOURCE}/apps/pacetrainer` },
    ],
  },
  {
    name: 'RollaPolla',
    tagline: {
      en: 'Ask, share, see the result roll in.',
      de: 'Fragen, teilen, Ergebnis reinrollen sehen.',
    },
    description: {
      en: 'Polls in seconds: create one, share the link, watch the votes arrive live. Server-side rendered for fast first loads and good share previews.',
      de: 'Umfragen in Sekunden: eine erstellen, den Link teilen, die Stimmen live ankommen sehen. Serverseitig gerendert für schnelle erste Ladezeiten und gute Vorschauen beim Teilen.',
    },
    accent: '#e879f9',
    tech: ['Analog.js', 'SSR', 'tRPC', 'Firebase'],
    links: [
      { label: 'Open', url: 'https://rollapolla.com/' },
      { label: 'Source', url: `${SOURCE}/apps/rollapolla-analog` },
    ],
  },
  {
    name: 'Angular Examples',
    tagline: {
      en: 'The lab: wild experiments in Angular.',
      de: 'Das Labor: wilde Experimente in Angular.',
    },
    description: {
      en: 'The showcase all the experiments below live in: a Native Federation shell that loads independently deployed remotes, zoneless and signal-based.',
      de: 'Das Schaufenster, in dem alle Experimente unten leben: eine Native-Federation-Shell, die unabhängig ausgelieferte Remotes lädt, zoneless und signalbasiert.',
    },
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
    tagline: {
      en: 'See the frequencies in a sound.',
      de: 'Sieh die Frequenzen in einem Klang.',
    },
    description: {
      en: 'Wrap a signal wave or your own microphone recording around a circle and watch its frequencies appear.',
      de: 'Wickle eine Signalwelle oder deine eigene Mikrofonaufnahme um einen Kreis und sieh zu, wie ihre Frequenzen erscheinen.',
    },
    accent: '#facc15',
    tech: ['Web Audio', 'Canvas'],
    links: [{ label: 'Try it', url: `${EXAMPLES}/fourierAnalysis` }],
  },
  {
    name: 'Shader Playground',
    tagline: {
      en: 'GLSL with a live editor.',
      de: 'GLSL mit Live-Editor.',
    },
    description: {
      en: 'Write and tweak fragment shaders in a code editor and see the result instantly, rendered with three.js.',
      de: 'Fragment-Shader in einem Code-Editor schreiben und anpassen und das Ergebnis sofort sehen, gerendert mit three.js.',
    },
    accent: '#a78bfa',
    tech: ['GLSL', 'three.js'],
    links: [{ label: 'Try it', url: `${EXAMPLES}/shaderExamples` }],
  },
  {
    name: 'Mandelbrot Deep Zoom',
    tagline: {
      en: 'Dive into the fractal.',
      de: 'Tauche ins Fraktal.',
    },
    description: {
      en: 'A real-time deep zoom renderer for the Mandelbrot set, running on WebGL shaders.',
      de: 'Ein Echtzeit-Deep-Zoom-Renderer für die Mandelbrot-Menge, der auf WebGL-Shadern läuft.',
    },
    accent: '#2dd4bf',
    tech: ['WebGL', 'three.js'],
    links: [{ label: 'Try it', url: `${EXAMPLES}/webGl` }],
  },
  {
    name: 'Reaction Diffusion',
    tagline: {
      en: 'Turing patterns, grown on the GPU.',
      de: 'Turing-Muster, gewachsen auf der GPU.',
    },
    description: {
      en: 'A Gray-Scott simulation in gpu.js: draw into the canvas and watch organic patterns grow.',
      de: 'Eine Gray-Scott-Simulation in gpu.js: Male in die Leinwand und sieh organische Muster wachsen.',
    },
    accent: '#fb923c',
    tech: ['gpu.js'],
    links: [{ label: 'Try it', url: `${EXAMPLES}/reactionDiff` }],
  },
  {
    name: 'Digit Recognition',
    tagline: {
      en: 'A neural network reads your handwriting.',
      de: 'Ein neuronales Netz liest deine Handschrift.',
    },
    description: {
      en: 'Draw a digit and a deep network trained on MNIST recognises it, right in the browser.',
      de: 'Zeichne eine Ziffer und ein auf MNIST trainiertes tiefes Netz erkennt sie, direkt im Browser.',
    },
    accent: '#60a5fa',
    tech: ['TensorFlow.js'],
    links: [{ label: 'Try it', url: `${EXAMPLES}/tensorflowExamples` }],
  },
  {
    name: 'Neural Networks',
    tagline: {
      en: 'Watch a perceptron learn.',
      de: 'Sieh einem Perzeptron beim Lernen zu.',
    },
    description: {
      en: 'A perceptron and a small network learning in real time, with their training data drawn in p5.js.',
      de: 'Ein Perzeptron und ein kleines Netz lernen in Echtzeit, ihre Trainingsdaten gezeichnet in p5.js.',
    },
    accent: '#f472b6',
    tech: ['p5.js'],
    links: [{ label: 'Try it', url: `${EXAMPLES}/neuralNetwork` }],
  },
  {
    name: 'Gravity World',
    tagline: {
      en: 'Build your own solar system.',
      de: 'Bau dein eigenes Sonnensystem.',
    },
    description: {
      en: 'Add planets around a sun and watch the orbits form in a little gravity simulation.',
      de: 'Setze Planeten um eine Sonne und sieh in einer kleinen Gravitationssimulation zu, wie sich die Bahnen formen.',
    },
    accent: '#fbbf24',
    tech: ['Canvas', 'Physics'],
    links: [{ label: 'Try it', url: `${EXAMPLES}/gravityWorld` }],
  },
  {
    name: 'Poisson Disk Sampling',
    tagline: {
      en: 'Random, but evenly spread.',
      de: 'Zufällig, aber gleichmäßig verteilt.',
    },
    description: {
      en: 'Evenly distributed random points, generated step by step from a seed you click.',
      de: 'Gleichmäßig verteilte Zufallspunkte, Schritt für Schritt erzeugt aus einem Startpunkt, den du anklickst.',
    },
    accent: '#4ade80',
    tech: ['Algorithms', 'Canvas'],
    links: [{ label: 'Try it', url: `${EXAMPLES}/poisson` }],
  },
  {
    name: 'GPU vs CPU',
    tagline: {
      en: 'Same picture, two speeds.',
      de: 'Gleiches Bild, zwei Geschwindigkeiten.',
    },
    description: {
      en: 'GPU-accelerated rendering with gpu.js and no shader code: toggle between GPU and CPU and compare the frame rate.',
      de: 'GPU-beschleunigtes Rendern mit gpu.js ohne Shader-Code: zwischen GPU und CPU umschalten und die Bildrate vergleichen.',
    },
    accent: '#c084fc',
    tech: ['gpu.js'],
    links: [{ label: 'Try it', url: `${EXAMPLES}/someGpuCalculations` }],
  },
  {
    name: 'Fibonacci in WebAssembly',
    tagline: {
      en: 'JavaScript against Wasm.',
      de: 'JavaScript gegen Wasm.',
    },
    description: {
      en: 'The same Fibonacci calculation in plain JavaScript and in AssemblyScript compiled to WebAssembly, side by side.',
      de: 'Dieselbe Fibonacci-Berechnung in reinem JavaScript und in AssemblyScript, kompiliert zu WebAssembly, Seite an Seite.',
    },
    accent: '#818cf8',
    tech: ['WebAssembly', 'AssemblyScript'],
    links: [{ label: 'Try it', url: `${EXAMPLES}/webassemblyTests` }],
  },
  {
    name: 'Thanos Snap Playground',
    tagline: {
      en: 'Snap a card into dust.',
      de: 'Schnipp eine Karte zu Staub.',
    },
    description: {
      en: 'Try every option of @wolsok/thanos: dissolve a card into dust, cracks, shards or chunks on the GPU and choose where the wind blows them.',
      de: 'Probiere jede Option von @wolsok/thanos: Löse eine Karte auf der GPU in Staub, Risse, Scherben oder Brocken auf und wähle, wohin der Wind sie weht.',
    },
    accent: '#a855f7',
    tech: ['WebGL2', 'Angular'],
    links: [{ label: 'Try it', url: `${EXAMPLES}/thanosPlayground` }],
  },
];

/** Packages published on npm. */
export const PACKAGES: Project[] = [
  {
    name: '@wolsok/thanos',
    tagline: {
      en: 'Snap your fingers, vaporize the DOM.',
      de: 'Schnipp mit den Fingern, verdampfe das DOM.',
    },
    description: {
      en: 'An Angular directive that dissolves any element into tiny particles, Thanos style: into dust, cracks, shards or chunks, blown away by the wind, simulated on the GPU.',
      de: 'Eine Angular-Direktive, die jedes Element in winzige Partikel auflöst, Thanos-Style: in Staub, Risse, Scherben oder Brocken, vom Wind verweht, simuliert auf der GPU.',
    },
    accent: '#a855f7',
    tech: ['Angular', 'WebGL2'],
    links: [
      { label: 'npm', url: 'https://www.npmjs.com/package/@wolsok/thanos' },
      { label: 'Playground', url: `${EXAMPLES}/thanosPlayground` },
      { label: 'Demo', url: `${EXAMPLES}/home?thanosDemo=true` },
      { label: 'Source', url: `${SOURCE}/libs/public/ws-thanos` },
    ],
  },
  {
    name: '@wolsok/nx-aws-cdk-v2',
    tagline: {
      en: 'AWS CDK v2 inside Nx.',
      de: 'AWS CDK v2 in Nx.',
    },
    description: {
      en: 'An Nx plugin to generate, synthesize, deploy and destroy AWS CDK v2 apps. It deploys every AWS stack of this site.',
      de: 'Ein Nx-Plugin, um AWS-CDK-v2-Apps zu generieren, zu synthetisieren, zu deployen und abzubauen. Es deployt jeden AWS-Stack dieser Seite.',
    },
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
