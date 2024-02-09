import { Geometry } from './geometry';
import {
  RenderingContext,
  RenderingContextWithProgram,
} from './rendering-context';

export class PlaneGeometry extends Geometry {
  private vertices: number[] = [];
  private buffer: WebGLBuffer | null = null;

  private readonly PLANE_GEOMETRY_ELEMENTS: number = 8;

  constructor(
    private readonly width: number,
    private readonly height: number,
    private readonly x = 0,
    private readonly y = 0
  ) {
    super();

    const absX = width / 2;
    const absY = height / 2;

    // prettier-ignore
    this.vertices.push(
        // Vertex positions
        -absX + x, absY + y, // V1: Top left
        -absX + x, -absY + y, // V2: Bottom left
        absX + x, absY + y,  // V3: Top right
        absX + x, -absY + y, // V4: Bottom right
    )
  }

  override update(ctx: RenderingContextWithProgram): RenderingContext {
    const { gl } = ctx;
    if (this.buffer) {
      return ctx;
    }
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array(this.vertices),
      gl.STATIC_DRAW
    );

    this.buffer = vertexBuffer;
    return ctx;
  }

  override render(ctx: RenderingContextWithProgram): RenderingContext {
    const { gl, program } = ctx;
    if (!this.buffer) {
      return ctx;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    const position = gl.getAttribLocation(program, 'aPosition');
    gl.vertexAttribPointer(
      position,
      2,
      gl.FLOAT,
      false,
      2 * Float32Array.BYTES_PER_ELEMENT,
      0
    );
    gl.enableVertexAttribArray(position);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); // Drawing a square using a triangle strip
    return ctx;
  }

  override dispose(gl: WebGL2RenderingContext): void {
    gl.deleteBuffer(this.buffer);
  }
}
