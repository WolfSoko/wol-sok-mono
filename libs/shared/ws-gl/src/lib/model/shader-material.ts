import { FragCode, VertCode } from './glsl-code.types';
import { setUniform } from './glsl-helper/uniform-helper';
import { Material } from './material';
import { RenderingContextWithProgram } from './rendering-context';
import { Uniform } from './uniforms';

export class ShaderMaterial extends Material {
  constructor(
    vertexShader: VertCode,
    fragmentShader: FragCode,
    private readonly uniforms: Record<string, Uniform>
  ) {
    super(vertexShader, fragmentShader);
  }

  protected override attachUniforms({
    gl,
    program,
  }: RenderingContextWithProgram): void {
    gl.useProgram(program);
    for (const uniform of Object.values(this.uniforms)) {
      setUniform(uniform, gl, program);
    }
  }
}
