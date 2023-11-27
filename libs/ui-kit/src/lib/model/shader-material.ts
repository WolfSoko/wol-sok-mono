import { FragCode, VertCode } from './glsl-code.types';
import { setUniform, Uniform } from './glsl-helper/uniforms';
import { Material } from './material';
import { RenderingContextWithProgram } from './rendering-context';

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
