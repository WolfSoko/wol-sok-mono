/**
 * GPU shaders for the Mandelbrot / Julia explorer.
 *
 * The fragment shader is compiled in two flavours, selected through the
 * `EMULATE_DOUBLE` define:
 *
 * - `0`: the orbit is iterated in plain 32 bit floats. Fast, but pixels start
 *   to clump together at roughly 10^5 magnification.
 * - `1`: the orbit is iterated in emulated 64 bit floats (a "double-single"
 *   pair of 32 bit floats). Roughly four times slower, but it keeps the image
 *   sharp down to ~6e11 magnification (see MIN_SCALE in fractal-view.ts).
 *
 * Both flavours share a single code path via the `S*` macros below, so the
 * escape time loop only exists once.
 */
export const MANDELBROT_VERTEX_SHADER = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

export const MANDELBROT_FRAGMENT_SHADER = `
  precision highp float;

  #ifndef EMULATE_DOUBLE
  #define EMULATE_DOUBLE 0
  #endif

  #define MAX_STEPS 4096
  #define BAILOUT_SQUARED 1048576.0
  #define TAU 6.283185307179586

  varying vec2 vUv;

  // Viewport in complex plane coordinates. The x/y components hold the high
  // and the low part of an emulated double (see splitFloat() on the TS side).
  uniform vec2 uCenterX;
  uniform vec2 uCenterY;
  uniform vec2 uScale;

  uniform vec2 uJuliaC;
  uniform vec2 uResolution;
  uniform float uAspect;
  uniform float uMaxIter;
  uniform float uMorph;
  uniform float uDensity;
  uniform float uShift;
  uniform float uPixelSize;
  uniform int uSamples;
  uniform int uColorMode;
  uniform int uPalette;

  #if EMULATE_DOUBLE

  // Knuth's two-sum, carrying the rounding error in the low component.
  vec2 dsAdd(vec2 a, vec2 b) {
    float t1 = a.x + b.x;
    float e = t1 - a.x;
    float t2 = ((b.x - e) + (a.x - (t1 - e))) + a.y + b.y;
    float hi = t1 + t2;
    return vec2(hi, t2 - (hi - t1));
  }

  // Dekker's product: splits both operands into 12 bit halves so that every
  // partial product is exact in 32 bit arithmetic.
  vec2 dsMul(vec2 a, vec2 b) {
    const float split = 8193.0;
    float conA = a.x * split;
    float conB = b.x * split;
    float aHi = conA - (conA - a.x);
    float bHi = conB - (conB - b.x);
    float aLo = a.x - aHi;
    float bLo = b.x - bHi;
    float c11 = a.x * b.x;
    float c21 = aLo * bLo + (aLo * bHi + (aHi * bLo + (aHi * bHi - c11)));
    float c2 = a.x * b.y + a.y * b.x;
    float t1 = c11 + c2;
    float e = t1 - c11;
    float t2 = a.y * b.y + ((c2 - e) + (c11 - (t1 - e))) + c21;
    float hi = t1 + t2;
    return vec2(hi, t2 - (hi - t1));
  }

  #define SCALAR vec2
  #define S_NUM(x) vec2(x, 0.0)
  #define S_ADD(a, b) dsAdd(a, b)
  #define S_SUB(a, b) dsAdd(a, -(b))
  #define S_MUL(a, b) dsMul(a, b)
  #define S_DOUBLE(a) ((a) + (a))
  #define S_FLOAT(a) ((a).x)
  #define S_UNIFORM(u) (u)

  #else

  #define SCALAR float
  #define S_NUM(x) (x)
  #define S_ADD(a, b) ((a) + (b))
  #define S_SUB(a, b) ((a) - (b))
  #define S_MUL(a, b) ((a) * (b))
  #define S_DOUBLE(a) ((a) + (a))
  #define S_FLOAT(a) (a)
  #define S_UNIFORM(u) ((u).x)

  #endif

  struct Orbit {
    float nu;    // fractional escape time, negative when the orbit stays bounded
    float trap;  // closest approach to the orbit trap
    float de;    // distance estimate towards the set, in complex plane units
  };

  Orbit traceOrbit(SCALAR cx, SCALAR cy, SCALAR zx, SCALAR zy) {
    // Derivative of the orbit, tracked in single precision: it only feeds the
    // distance estimate, which is a purely visual cue.
    float dzx = 1.0;
    float dzy = 0.0;
    float dzSeed = 1.0 - uMorph;
    float trap = 1e10;
    float n = 0.0;
    float magnitudeSquared = 0.0;
    bool escaped = false;

    for (int i = 0; i < MAX_STEPS; i++) {
      if (n >= uMaxIter) {
        break;
      }

      SCALAR zx2 = S_MUL(zx, zx);
      SCALAR zy2 = S_MUL(zy, zy);
      magnitudeSquared = S_FLOAT(zx2) + S_FLOAT(zy2);
      if (magnitudeSquared > BAILOUT_SQUARED) {
        escaped = true;
        break;
      }

      float fx = S_FLOAT(zx);
      float fy = S_FLOAT(zy);
      float nextDzx = 2.0 * (fx * dzx - fy * dzy) + dzSeed;
      dzy = 2.0 * (fx * dzy + fy * dzx);
      dzx = nextDzx;

      SCALAR nextZx = S_ADD(S_SUB(zx2, zy2), cx);
      zy = S_ADD(S_DOUBLE(S_MUL(zx, zy)), cy);
      zx = nextZx;

      // Cross shaped orbit trap, evaluated on the updated orbit so that the
      // z = 0 seed of the Mandelbrot set does not trap everything at once.
      trap = min(trap, min(abs(S_FLOAT(zx)), abs(S_FLOAT(zy))));
      n += 1.0;
    }

    Orbit orbit;
    orbit.trap = trap;

    if (escaped) {
      float logZ = 0.5 * log(magnitudeSquared);
      // Continuous escape time, so neighbouring pixels blend instead of banding.
      orbit.nu = n + 1.0 - log(logZ / log(2.0)) / log(2.0);
      float dz = sqrt(dzx * dzx + dzy * dzy);
      orbit.de = dz > 0.0 ? sqrt(magnitudeSquared) * logZ / dz : 0.0;
    } else {
      orbit.nu = -1.0;
      orbit.de = 0.0;
    }

    return orbit;
  }

  vec3 cosinePalette(vec3 bias, vec3 amp, vec3 freq, vec3 phase, float t) {
    return clamp(bias + amp * cos(TAU * (freq * t + phase)), 0.0, 1.0);
  }

  vec3 cyclicGradient(float t, vec3 c0, vec3 c1, vec3 c2, vec3 c3, vec3 c4) {
    float p = fract(t) * 5.0;
    float f = fract(p);
    if (p < 1.0) { return mix(c0, c1, f); }
    if (p < 2.0) { return mix(c1, c2, f); }
    if (p < 3.0) { return mix(c2, c3, f); }
    if (p < 4.0) { return mix(c3, c4, f); }
    return mix(c4, c0, f);
  }

  vec3 paletteColor(float t) {
    t = fract(t);
    if (uPalette == 0) {
      // Aurora
      return cosinePalette(
        vec3(0.46, 0.5, 0.52), vec3(0.42, 0.46, 0.5),
        vec3(1.0), vec3(0.0, 0.18, 0.42), t
      );
    }
    if (uPalette == 1) {
      // Ember
      return cosinePalette(
        vec3(0.5, 0.28, 0.16), vec3(0.5, 0.36, 0.22),
        vec3(1.0), vec3(0.02, 0.12, 0.2), t
      );
    }
    if (uPalette == 2) {
      // Ultra: the classic deep blue / cream / amber ramp
      return cyclicGradient(
        t,
        vec3(0.0, 0.027, 0.392), vec3(0.125, 0.42, 0.796),
        vec3(0.929, 1.0, 1.0), vec3(1.0, 0.667, 0.0),
        vec3(0.0, 0.008, 0.0)
      );
    }
    if (uPalette == 3) {
      // Ice
      return cosinePalette(
        vec3(0.56, 0.6, 0.68), vec3(0.38, 0.36, 0.3),
        vec3(1.0), vec3(0.5, 0.56, 0.64), t
      );
    }
    if (uPalette == 4) {
      // Spectrum
      return cosinePalette(
        vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.0, 0.33, 0.67), t
      );
    }
    // Blueprint
    float g = 0.5 + 0.5 * cos(TAU * t);
    return clamp(vec3(0.12, 0.52, 1.0) * g + vec3(0.03, 0.04, 0.06), 0.0, 1.0);
  }

  vec3 shade(Orbit orbit) {
    if (orbit.nu < 0.0) {
      // Inside the set: a faint, cool glow driven by the orbit trap keeps the
      // interior from being a flat black blob without stealing attention.
      float inner = exp(-orbit.trap * 5.0);
      return vec3(0.035, 0.05, 0.085) + vec3(0.06, 0.085, 0.14) * inner;
    }

    if (uColorMode == 1) {
      float t = pow(clamp(orbit.trap, 0.0, 1.0), 0.35) * uDensity + uShift;
      float shine = exp(-orbit.trap * 7.0);
      return clamp(paletteColor(t) * (0.3 + 0.7 * shine) + shine * shine * 0.22, 0.0, 1.0);
    }

    float t = sqrt(max(orbit.nu, 0.0)) * 0.09 * uDensity + uShift;
    vec3 base = paletteColor(t);

    if (uColorMode == 2) {
      float d = clamp(log(1.0 + orbit.de / max(uPixelSize, 1e-30)) * 0.42, 0.0, 1.0);
      return base * pow(d, 0.75) + vec3(0.02, 0.02, 0.03) * (1.0 - d);
    }

    return base;
  }

  vec3 sampleFractal(vec2 offsetInPixels) {
    vec2 p = (vUv - 0.5 + offsetInPixels / uResolution) * 2.0;
    p.x *= uAspect;

    SCALAR px = S_ADD(S_UNIFORM(uCenterX), S_MUL(S_NUM(p.x), S_UNIFORM(uScale)));
    SCALAR py = S_ADD(S_UNIFORM(uCenterY), S_MUL(S_NUM(p.y), S_UNIFORM(uScale)));

    // uMorph blends the Mandelbrot set (0) into the Julia set of uJuliaC (1):
    // the seed travels from 0 to the pixel while c travels to the Julia
    // constant, which keeps every in-between frame a valid quadratic Julia set.
    SCALAR morph = S_NUM(uMorph);
    SCALAR keep = S_NUM(1.0 - uMorph);
    SCALAR zx = S_MUL(px, morph);
    SCALAR zy = S_MUL(py, morph);
    SCALAR cx = S_ADD(S_MUL(px, keep), S_MUL(S_NUM(uJuliaC.x), morph));
    SCALAR cy = S_ADD(S_MUL(py, keep), S_MUL(S_NUM(uJuliaC.y), morph));

    return shade(traceOrbit(cx, cy, zx, zy));
  }

  void main() {
    vec3 color = vec3(0.0);
    float weight = 0.0;
    float stepSize = 1.0 / float(uSamples);

    for (int sy = 0; sy < 3; sy++) {
      if (sy >= uSamples) { break; }
      for (int sx = 0; sx < 3; sx++) {
        if (sx >= uSamples) { break; }
        vec2 offset = (vec2(float(sx), float(sy)) + 0.5) * stepSize - 0.5;
        color += sampleFractal(offset);
        weight += 1.0;
      }
    }

    gl_FragColor = vec4(color / max(weight, 1.0), 1.0);
  }
`;
