import { VertCode } from '@wolsok/ws-gl';

export const textureVertexShader: VertCode = `# version 300 es
// Vertex Shader (vsSource)
in vec4 aVertexPosition;
in vec2 aTextureCoord;
in float aTime;
out vec2 vTextureCoord;
out float vTime;

void main() {
  gl_Position = aVertexPosition;
  vTextureCoord = aTextureCoord;
  vTime = aTime;
}` as VertCode;
