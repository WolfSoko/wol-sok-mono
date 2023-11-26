# version 300 es
// Fragment Shader
precision mediump float;

in vec2 vTextureCoord;
in mediump float vTime;
uniform highp sampler2D uSampler;

out highp vec4 fragColor;

void main() {
  fragColor = texture(uSampler, vTextureCoord);
  mediump float  normTime = vTime * 0.01;

  // Einfacher Zerfallseffekt basierend auf der Zeit
  mediump float noise = fract(sin(dot(vTextureCoord.xy ,vec2(12.9898,78.233))) * 43758.5453);
  fragColor = texture(uSampler, vTextureCoord);
  mediump float alpha = smoothstep(1.0, 0.0, noise + vTime * 0.1);

  fragColor = vec4(fragColor.rgb, fragColor.a * alpha);
}

