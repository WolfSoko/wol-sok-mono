/*
 * Public API Surface of @wolsok/loading-wave/shaders: the built-in shaders
 * beside the default. A secondary entry point of their own, so an app that
 * shares the lib's main entry (Native Federation bundles an entry whole)
 * loads none of them until it imports one.
 */
export { circuitTracesShader } from './lib/webgl/shaders/circuit-traces.shader';
export { dataBusShader } from './lib/webgl/shaders/data-bus.shader';
export { dieScanShader } from './lib/webgl/shaders/die-scan.shader';
export { signalTraceShader } from './lib/webgl/shaders/signal-trace.shader';
