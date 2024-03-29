import { u4f } from './uniforms';
import { ShaderMaterial } from './shader-material';
import colorMaterialFrag from './shaders/color-material.frag';
import colorMaterialVert from './shaders/color-material.vert';

export class ColorMaterial extends ShaderMaterial {
  constructor(
    private readonly r = 0,
    private readonly g = 0,
    private readonly b = 0,
    private readonly alpha = 1
  ) {
    super(colorMaterialVert, colorMaterialFrag, {
      uColor: u4f('uColor', r, g, b, alpha),
    });
  }
}
