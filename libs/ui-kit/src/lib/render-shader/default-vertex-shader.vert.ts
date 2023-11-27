import { VertCode } from '../model/glsl-code.types';
export default `# version 300 es

in vec2 pUv;
in vec2 aPosition;
out highp vec2 vUv;

void main()	{
    vUv = aPosition;
    gl_Position = vec4( aPosition , 0, 1.0 );
}
` as VertCode;
