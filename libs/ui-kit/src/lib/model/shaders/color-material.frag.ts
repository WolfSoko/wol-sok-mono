import { FragCode } from '../glsl-code.types';

export default `#version 300 es
#ifdef GL_ES
precision highp float;
#endif

uniform vec4 uColor;
out vec4 fragColor;
in vec2 vPosition;

void main(){
  fragColor = uColor;
}
` as FragCode;
