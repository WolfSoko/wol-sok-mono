// Fragment Shader (fsSource)
precision mediump float;
varying vec2 vTextureCoord;
uniform float uTime;
uniform sampler2D uSampler;

void main() {
  gl_FragColor = texture2D(uSampler, vTextureCoord);
  float normTime = uTime * 0.01;

  // Einfacher Zerfallseffekt basierend auf der Zeit
  float noise = fract(sin(dot(vTextureCoord.xy ,vec2(12.9898,78.233))) * 43758.5453);
  gl_FragColor = texture2D(uSampler, vTextureCoord);
  float alpha = smoothstep(1.0, 0.0, noise + uTime * 0.1);

  gl_FragColor = vec4(gl_FragColor.rgb, gl_FragColor.a * alpha);
}

