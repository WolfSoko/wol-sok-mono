import { u4f } from './glsl-helper/uniforms';
import { ShaderMaterial } from './shader-material';
import colorMaterialFrag from './shaders/color-material.frag';
import colorMaterialVert from './shaders/color-material.vert';

export class ColorMaterial extends ShaderMaterial {
  constructor(
    private readonly r: number = 0,
    private readonly g: number = 0,
    private readonly b: number = 0,
    private readonly alpha: number = 1
  ) {
    super(colorMaterialVert, colorMaterialFrag, {
      uColor: u4f('uColor', r, g, b, alpha),
    });
  }
}
