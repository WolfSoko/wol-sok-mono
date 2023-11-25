// Vertex Shader (vsSource)
attribute vec4 aVertexPosition;
attribute vec2 aTextureCoord;
varying vec2 vTextureCoord;

void main() {
  gl_Position = aVertexPosition;
  vTextureCoord = aTextureCoord;
}

