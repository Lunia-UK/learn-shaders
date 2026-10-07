// WebGL2 core: put a fragment shader on screen or in an offscreen image, and read pixels back.
// Shared by the course, the playground and the export. No framework imports here.

const VERTEX_SOURCE = `#version 300 es
in vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}`;

// One triangle big enough to cover the whole viewport (clip space runs from -1 to 1).
// The parts outside the viewport are clipped away for free, and unlike two triangles
// forming a quad there is no diagonal seam where pixels get shaded twice.
const FULLSCREEN_TRIANGLE = new Float32Array([-1, -1, 3, -1, -1, 3]);
const POSITION_ATTRIBUTE = 0;

/** A uniform value: a single number, or the components of a vector, matrix or array. */
export type UniformValue = number | number[];

interface ActiveUniform {
  location: WebGLUniformLocation;
  type: GLenum;
}

export interface ShaderProgram {
  readonly handle: WebGLProgram;
  /** Uniforms the compiler kept, looked up once after linking. */
  readonly uniforms: ReadonlyMap<string, ActiveUniform>;
}

export type CompileResult =
  { ok: true; program: ShaderProgram } | { ok: false; stage: 'compile' | 'link'; log: string };

/** An offscreen image to draw into, for scoring, probing or exporting. */
export interface RenderTarget {
  readonly width: number;
  readonly height: number;
  readonly framebuffer: WebGLFramebuffer;
  readonly texture: WebGLTexture;
}

export interface DrawOptions {
  /** Where to draw. Omit to draw on the canvas itself. */
  target?: RenderTarget | null;
  /** Values for the shader's uniforms. Names the shader does not use are ignored. */
  uniforms?: Record<string, UniformValue>;
}

export interface ReadOptions {
  /** Where to read from. Omit to read the canvas. */
  target?: RenderTarget | null;
  /** Area to read, in pixels from the bottom-left corner. Defaults to everything. */
  x?: number;
  y?: number;
  width?: number;
  height?: number;
}

export interface RendererOptions {
  /** Keep the canvas content after it is shown, so it can be read back later (e.g. for a PNG). */
  preserveDrawingBuffer?: boolean;
}

export class Renderer {
  readonly gl: WebGL2RenderingContext;
  private readonly vertexShader: WebGLShader;
  private readonly vertexBuffer: WebGLBuffer;
  private readonly vertexArray: WebGLVertexArrayObject;

  /** Returns null when the browser has no WebGL2, so the page can show a message instead. */
  static create(canvas: HTMLCanvasElement, options: RendererOptions = {}): Renderer | null {
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      depth: false,
      stencil: false,
      preserveDrawingBuffer: options.preserveDrawingBuffer ?? false,
    });
    return gl ? new Renderer(gl) : null;
  }

  private constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    // Dithering may add noise to the last bit of each color; read-backs must be exact.
    gl.disable(gl.DITHER);

    const vertexShader = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SOURCE);
    if ('log' in vertexShader) throw new Error(`Vertex shader failed: ${vertexShader.log}`);
    this.vertexShader = vertexShader.shader;

    this.vertexArray = created(gl.createVertexArray(), 'vertex array');
    this.vertexBuffer = created(gl.createBuffer(), 'buffer');
    gl.bindVertexArray(this.vertexArray);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, FULLSCREEN_TRIANGLE, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(POSITION_ATTRIBUTE);
    gl.vertexAttribPointer(POSITION_ATTRIBUTE, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);
  }

  /** Compiles a complete fragment shader and links it with the fullscreen vertex shader. */
  compile(fragmentSource: string): CompileResult {
    const gl = this.gl;
    const fragment = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    if ('log' in fragment) return { ok: false, stage: 'compile', log: fragment.log };

    const handle = created(gl.createProgram(), 'program');
    gl.attachShader(handle, this.vertexShader);
    gl.attachShader(handle, fragment.shader);
    gl.bindAttribLocation(handle, POSITION_ATTRIBUTE, 'position');
    gl.linkProgram(handle);
    // The program keeps what it needs; the fragment shader object is no longer useful.
    gl.deleteShader(fragment.shader);

    if (!gl.getProgramParameter(handle, gl.LINK_STATUS)) {
      const log = gl.getProgramInfoLog(handle) || 'Unknown link error';
      gl.deleteProgram(handle);
      return { ok: false, stage: 'link', log };
    }
    return { ok: true, program: { handle, uniforms: activeUniforms(gl, handle) } };
  }

  /** Releases a program. GPU memory is not garbage collected, so call this when replacing one. */
  free(program: ShaderProgram): void {
    this.gl.deleteProgram(program.handle);
  }

  /** Runs the fragment shader once for every pixel of the canvas or of a render target. */
  draw(program: ShaderProgram, { target = null, uniforms = {} }: DrawOptions = {}): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null);
    if (target) gl.viewport(0, 0, target.width, target.height);
    else gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);

    gl.useProgram(program.handle);
    for (const [name, value] of Object.entries(uniforms)) {
      // The compiler removes uniforms the code never reads (a shader without `time`, say).
      // Setting them would be an error, so they are skipped.
      const uniform = program.uniforms.get(name);
      if (uniform) setUniform(gl, name, uniform, value);
    }

    gl.bindVertexArray(this.vertexArray);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.bindVertexArray(null);
  }

  /** Creates an offscreen RGBA image with 8 bits per channel, the same format as the canvas. */
  createTarget(width: number, height: number): RenderTarget {
    const gl = this.gl;
    const texture = created(gl.createTexture(), 'texture');
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, width, height);
    // No smoothing between pixels: each one is read exactly as the shader wrote it.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    const framebuffer = created(gl.createFramebuffer(), 'framebuffer');
    gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
      gl.deleteFramebuffer(framebuffer);
      gl.deleteTexture(texture);
      throw new Error(
        `Render target ${width}×${height} is incomplete (status 0x${status.toString(16)})`,
      );
    }
    return { width, height, framebuffer, texture };
  }

  freeTarget(target: RenderTarget): void {
    this.gl.deleteFramebuffer(target.framebuffer);
    this.gl.deleteTexture(target.texture);
  }

  /**
   * Reads pixels as RGBA bytes (0 to 255), 4 per pixel.
   * Rows go from bottom to top, like `uv`: the first pixel is the bottom-left one.
   *
   * Reading the canvas only works in the same task as the draw, unless the renderer
   * was created with `preserveDrawingBuffer`: the browser clears it once it is shown.
   */
  readPixels({ target = null, x = 0, y = 0, width, height }: ReadOptions = {}): Uint8Array {
    const gl = this.gl;
    const w = width ?? (target ? target.width : gl.drawingBufferWidth) - x;
    const h = height ?? (target ? target.height : gl.drawingBufferHeight) - y;
    const out = new Uint8Array(w * h * 4);
    gl.bindFramebuffer(gl.FRAMEBUFFER, target?.framebuffer ?? null);
    gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, out);
    return out;
  }

  /**
   * Releases everything, including the WebGL context itself. Browsers allow only a
   * handful of live contexts per page, so a lesson with several canvases needs this.
   */
  dispose(): void {
    const gl = this.gl;
    gl.deleteVertexArray(this.vertexArray);
    gl.deleteBuffer(this.vertexBuffer);
    gl.deleteShader(this.vertexShader);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
  }
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: GLenum,
  source: string,
): { shader: WebGLShader } | { log: string } {
  const shader = created(gl.createShader(type), 'shader');
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) || 'Unknown compile error';
    gl.deleteShader(shader);
    return { log };
  }
  return { shader };
}

function activeUniforms(gl: WebGL2RenderingContext, program: WebGLProgram) {
  const uniforms = new Map<string, ActiveUniform>();
  const count: number = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < count; i++) {
    const info = gl.getActiveUniform(program, i);
    if (!info) continue;
    const location = gl.getUniformLocation(program, info.name);
    if (!location) continue;
    // Arrays are reported as "name[0]"; callers use the plain name.
    uniforms.set(info.name.replace(/\[0\]$/, ''), { location, type: info.type });
  }
  return uniforms;
}

function setUniform(
  gl: WebGL2RenderingContext,
  name: string,
  { location, type }: ActiveUniform,
  value: UniformValue,
): void {
  const data = typeof value === 'number' ? [value] : value;
  switch (type) {
    case gl.FLOAT:
      return gl.uniform1fv(location, data);
    case gl.FLOAT_VEC2:
      return gl.uniform2fv(location, data);
    case gl.FLOAT_VEC3:
      return gl.uniform3fv(location, data);
    case gl.FLOAT_VEC4:
      return gl.uniform4fv(location, data);
    case gl.INT:
    case gl.BOOL:
    case gl.SAMPLER_2D:
      return gl.uniform1iv(location, data);
    case gl.INT_VEC2:
    case gl.BOOL_VEC2:
      return gl.uniform2iv(location, data);
    case gl.INT_VEC3:
    case gl.BOOL_VEC3:
      return gl.uniform3iv(location, data);
    case gl.INT_VEC4:
    case gl.BOOL_VEC4:
      return gl.uniform4iv(location, data);
    case gl.UNSIGNED_INT:
      return gl.uniform1uiv(location, data);
    case gl.FLOAT_MAT2:
      return gl.uniformMatrix2fv(location, false, data);
    case gl.FLOAT_MAT3:
      return gl.uniformMatrix3fv(location, false, data);
    case gl.FLOAT_MAT4:
      return gl.uniformMatrix4fv(location, false, data);
    default:
      throw new Error(
        `Uniform "${name}" has a type the engine cannot set yet (0x${type.toString(16)})`,
      );
  }
}

/** WebGL returns null from create* calls only when the context is lost. */
function created<T>(value: T | null, what: string): T {
  if (value === null) throw new Error(`Could not create a WebGL ${what}: the context is lost`);
  return value;
}
