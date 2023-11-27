import { VertCode } from '../glsl-code.types';

export default `#version 300 es
#ifdef GL_ES
precision highp float;
#endif

in vec2 aPosition;
out vec2 vPosition;

void main(){
  vPosition = aPosition;
  gl_Position = vec4(aPosition, 0.0, 1.0);
  gl_PointSize = 150.0;
}
` as VertCode;
