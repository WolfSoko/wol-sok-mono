/**
 * The playground's starting point for one's own shader: lit dots that grow
 * and a scan of light running over them, in the accent colour. Rests
 * without `ws_time` at `ws_wave == 0`, as the contract asks.
 */
export const CUSTOM_SHADER_EXAMPLE = `// wsShade gets a point in CSS pixels and returns its colour and opacity.
// The ws_* uniforms and helpers are listed in the README of @wolsok/loading-wave.
vec4 wsShade(vec2 point) {
  vec2 center = ws_cellCenter(ws_cell(point));
  float lit = ws_waveIntensity(center);
  float core = ws_dotDisk(point, center, 0.5 * ws_dotSize * (1.0 + 2.0 * lit));
  float scan = lit * (0.5 + 0.5 * sin(point.y * 0.5 - ws_time * 8.0));
  vec4 ink = ws_ink(lit);
  float dots = core * ink.a * mix(WS_REST_ALPHA, WS_LIT_ALPHA, lit);
  float glow = 0.15 * scan * ws_accent.a;
  float alpha = dots + glow;
  vec3 color = (ink.rgb * dots + ws_accent.rgb * glow) / max(alpha, 1.0e-4);
  return vec4(color, alpha);
}
`;
