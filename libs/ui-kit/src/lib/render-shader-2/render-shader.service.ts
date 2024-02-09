import { Injectable } from '@angular/core';
import { FragCode, VertCode } from '@wolsok/ws-gl';
import { vaporizingTextureFragmentShader } from './vaporizing-fragment-shader.glsl';
import { textureVertexShader } from './texture-vertex-shader.glsl';

type Texture = { glTexture: WebGLTexture; w: number; h: number };
type Context = {
  gl: WebGL2RenderingContext;
  shaderProgram: WebGLProgram;
  texture: Texture;
};

@Injectable({
  providedIn: 'root',
})
export class WebglService {
  private gl: WebGL2RenderingContext | null = null;
  private shaderProgram: WebGLProgram | null = null;
  private texture: Texture | null = null;

  private aTime: number | null = null;

  public initializeWebGL(canvas: HTMLCanvasElement): boolean {
    this.gl = canvas.getContext('webgl2');
    if (!this.gl) {
      console.error('WebGL not supported');
      return false;
    }

    this.shaderProgram = this.initShaders(this.gl);
    return true;
  }

  public renderImage(imageData: ImageData | HTMLImageElement): void {
    if (!this.gl) {
      console.error('WebGL-Context is not initialized');
      return;
    }
    if (!this.shaderProgram) {
      console.error('WebGL-ShaderProgram is not initialized');
      return;
    }

    this.createTextureFromImageData(imageData, this.gl);

    if (!this.texture) {
      console.error('WebGL-Texture is not initialized');
      return;
    }

    this.drawScene(this.createContext());
  }

  public render(dTime: number) {
    const context: Context = this.createContext();
    this.updateEllapsedTime(dTime, context);
    // this.drawScene(context);
    context.gl.drawArrays(context.gl.TRIANGLE_STRIP, 0, 4);
  }

  private updateEllapsedTime(
    elapsedTime: number,
    { gl, shaderProgram }: Context
  ) {
    if (!this.aTime) {
      this.aTime = gl.getAttribLocation(shaderProgram, 'aTime');
    }
    gl.vertexAttrib1f(this.aTime, elapsedTime);
  }

  private initShaders(
    gl: WebGLRenderingContext,
    vertexShaderCode: VertCode = textureVertexShader,
    fragmentShaderCode: FragCode = vaporizingTextureFragmentShader
  ) {
    const vertexShader = this.compileShader(
      gl.VERTEX_SHADER,
      vertexShaderCode,
      gl
    );
    const fragmentShader = this.compileShader(
      gl.FRAGMENT_SHADER,
      fragmentShaderCode,
      gl
    );

    const shaderProgram = gl.createProgram();
    if (!shaderProgram) {
      throw Error('Unable to create the shader program');
    }

    gl.attachShader(shaderProgram, vertexShader);
    gl.attachShader(shaderProgram, fragmentShader);
    gl.linkProgram(shaderProgram);

    if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
      console.log('Vertex shader info log:', gl.getShaderInfoLog(vertexShader));
      console.log(
        'Fragment shader info log:',
        gl.getShaderInfoLog(fragmentShader)
      );
      console.log('Program info log', gl.getProgramInfoLog(shaderProgram));
      throw Error('Unable to initialize the shader program');
    }

    const positionAttributeLocation = gl.getAttribLocation(
      shaderProgram,
      'aVertexPosition'
    );
    const textureCoordAttributeLocation = gl.getAttribLocation(
      shaderProgram,
      'aTextureCoord'
    );

    const timeAttributeLocation = gl.getAttribLocation(shaderProgram, 'aTime');

    if (
      positionAttributeLocation === -1 ||
      textureCoordAttributeLocation === -1 ||
      timeAttributeLocation === -1
    ) {
      console.error('Attribute location not found', {
        positionAttributeLocation,
        textureCoordAttributeLocation,
        timeAttributeLocation,
      });
    }

    return shaderProgram;
  }

  private compileShader(
    type: number,
    source: string,
    gl: WebGLRenderingContext
  ): WebGLShader {
    const shader = gl.createShader(type);

    if (!shader) {
      throw new Error(
        `Error: Could not createShader of type: ${
          type === gl.FRAGMENT_SHADER ? 'FRAGMENT_SHADER' : 'VERTEX_SHADER'
        }`
      );
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error(
        'An error occurred compiling the shaders:',
        gl.getShaderInfoLog(shader)
      );
      gl.deleteShader(shader);
      throw new Error(
        `Error: Could not createShader of type: ${
          type === gl.FRAGMENT_SHADER ? 'FRAGMENT_SHADER' : 'VERTEX_SHADER'
        }`
      );
    }
    return shader;
  }

  private createTextureFromImageData(
    image: ImageData | HTMLImageElement,
    gl: WebGL2RenderingContext
  ) {
    const glTexture = gl.createTexture();

    if (!glTexture) {
      throw Error('Could not create texture');
    }
    this.texture = {
      glTexture,
      w: image.width,
      h: image.height,
    };

    gl.bindTexture(gl.TEXTURE_2D, this.texture.glTexture);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      image.width,
      image.height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      image
    );

    gl.bindTexture(gl.TEXTURE_2D, this.texture.glTexture);
  }

  private drawScene({ gl, shaderProgram, texture }: Context) {
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    gl.useProgram(shaderProgram);

    // Set up vertex buffer, attributes, etc.
    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

    // Example vertex positions for a square (2 triangles)

    const textureWidth = texture.w;
    const textureHeight = texture.h;
    const canvasWidth = gl.canvas.width;
    const canvasHeight = gl.canvas.height;

    // calc relation between canvas and image
    // multiplication by 2, because the range is -1.0 to 1.0
    const xScale = (textureWidth / canvasWidth) * 2;
    const yScale = (textureHeight / canvasHeight) * 2;
    // const xScale = 0.5;
    // const yScale = 0.5;

    // prettier-ignore
    const vertices = [
      // Vertex positions     // Texture coordinates
      -xScale, yScale,        0.0, 1.0,  // V1: Top left
      -xScale, -yScale,       0.0, 0.0,  // V2: Bottom left
      xScale, yScale,         1.0, 1.0,  // V3: Top right
      xScale, -yScale,        1.0, 0.0,  // V4: Bottom right
    ];

    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    // Define how to read the vertex buffer
    const position = gl.getAttribLocation(shaderProgram, 'aVertexPosition');
    gl.vertexAttribPointer(
      position,
      2,
      gl.FLOAT,
      false,
      4 * Float32Array.BYTES_PER_ELEMENT,
      0
    );
    gl.enableVertexAttribArray(position);

    const textureCoord = gl.getAttribLocation(shaderProgram, 'aTextureCoord');
    gl.vertexAttribPointer(
      textureCoord,
      2,
      gl.FLOAT,
      false,
      4 * Float32Array.BYTES_PER_ELEMENT,
      2 * Float32Array.BYTES_PER_ELEMENT
    );
    gl.enableVertexAttribArray(textureCoord);

    const imageTextureUnit = 0;
    // Bind the texture
    gl.activeTexture(gl.TEXTURE0 + imageTextureUnit);
    gl.bindTexture(gl.TEXTURE_2D, texture.glTexture);
    gl.uniform1i(
      gl.getUniformLocation(shaderProgram, 'uSampler'),
      imageTextureUnit
    );
    // Draw your object
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); // Drawing a square using a triangle strip
  }

  private createContext(): Context {
    if (!this.gl || !this.texture || !this.shaderProgram) {
      throw Error('Render Shader not initialized');
    }
    return {
      gl: this.gl,
      texture: this.texture,
      shaderProgram: this.shaderProgram,
    };
  }
}
