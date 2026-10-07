// A live shader on a canvas: compiles lesson code, keeps the last valid program on errors,
// sizes the canvas for sharp pixels, and draws only when something changed (or every frame
// while the code uses `time`). Shared by lessons, the playground and the export preview.

import { assemble, parseCompileLog, UNIFORMS } from './assemble';
import { explainErrors, type ExplainedError } from './explain';
import { Renderer, type ShaderProgram } from './gl';

/** Above 2, extra pixels cost a lot of GPU time for a difference few people can see. */
export const MAX_PIXEL_RATIO = 2;

export interface ShaderViewOptions {
  /** Shared GLSL helpers placed before the code. */
  helpers?: string[];
  /** Whether animated shaders start playing. Defaults to false when the user prefers reduced motion. */
  playing?: boolean;
}

/** Size of the drawing buffer for a canvas shown at `cssWidth`×`cssHeight` CSS pixels. */
export function drawingBufferSize(
  cssWidth: number,
  cssHeight: number,
  devicePixelRatio: number,
): { width: number; height: number } {
  const ratio = Math.min(devicePixelRatio || 1, MAX_PIXEL_RATIO);
  return {
    width: Math.max(1, Math.round(cssWidth * ratio)),
    height: Math.max(1, Math.round(cssHeight * ratio)),
  };
}

export class ShaderView {
  /** How many times the shader was drawn. Lets tests check that idle views do not redraw. */
  framesDrawn = 0;

  private renderer: Renderer;
  private program: ShaderProgram | null = null;
  /** The last code that compiled, to rebuild the program if the GPU context is lost. */
  private lastValid: { code: string; helpers: string[] } | null = null;
  private helpers: string[];
  private animated = false;
  private playing: boolean;
  /** Seconds of animation played so far. Pausing stops the clock instead of skipping ahead. */
  private time = 0;
  private lastTick: number | null = null;
  private frameRequest = 0;
  private readonly resizeObserver: ResizeObserver;

  /** Returns null when the browser has no WebGL2. */
  static create(canvas: HTMLCanvasElement, options: ShaderViewOptions = {}): ShaderView | null {
    const renderer = Renderer.create(canvas);
    return renderer ? new ShaderView(canvas, renderer, options) : null;
  }

  private constructor(
    private readonly canvas: HTMLCanvasElement,
    renderer: Renderer,
    options: ShaderViewOptions,
  ) {
    this.renderer = renderer;
    this.helpers = options.helpers ?? [];
    this.playing = options.playing ?? !prefersReducedMotion();

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  /**
   * Compiles new code. On success the view switches to it; on failure it keeps drawing
   * the last valid program and returns the errors, explained.
   */
  setCode(code: string, helpers: string[] = this.helpers): ExplainedError[] {
    this.helpers = helpers;
    const shader = assemble(code, { helpers });
    const result = this.renderer.compile(shader.source);
    if (!result.ok) return explainErrors(parseCompileLog(result.log, shader));

    if (this.program) this.renderer.free(this.program);
    this.program = result.program;
    this.lastValid = { code, helpers };
    // The compiler drops uniforms the code never reads, so this tells whether it uses time.
    this.animated = result.program.uniforms.has(UNIFORMS.time);
    this.requestFrame();
    return [];
  }

  /** True when the current code uses `time`. */
  get isAnimated(): boolean {
    return this.animated;
  }

  get isPlaying(): boolean {
    return this.playing;
  }

  setPlaying(playing: boolean): void {
    this.playing = playing;
    this.lastTick = null;
    this.requestFrame();
  }

  /** Draws the current frame and returns its pixels (RGBA, bottom row first). */
  capture(): Uint8Array {
    this.draw();
    return this.renderer.readPixels();
  }

  dispose(): void {
    cancelAnimationFrame(this.frameRequest);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('webglcontextlost', this.onContextLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onContextRestored);
    if (this.program) this.renderer.free(this.program);
    this.program = null;
    this.renderer.dispose();
  }

  private get running(): boolean {
    return this.animated && this.playing && this.program !== null;
  }

  private requestFrame(): void {
    if (this.frameRequest === 0) this.frameRequest = requestAnimationFrame(this.onFrame);
  }

  private onFrame = (now: number): void => {
    this.frameRequest = 0;
    if (this.running && this.lastTick !== null) this.time += (now - this.lastTick) / 1000;
    this.lastTick = this.running ? now : null;
    this.draw();
    if (this.running) this.requestFrame();
  };

  private draw(): void {
    if (!this.program) return;
    this.renderer.draw(this.program, {
      uniforms: {
        [UNIFORMS.resolution]: [this.canvas.width, this.canvas.height],
        [UNIFORMS.time]: this.time,
      },
    });
    this.framesDrawn++;
  }

  private resize(): void {
    const { width, height } = drawingBufferSize(
      this.canvas.clientWidth,
      this.canvas.clientHeight,
      window.devicePixelRatio,
    );
    if (width === this.canvas.width && height === this.canvas.height) return;
    // Changing the size clears the canvas, so draw right away to avoid a blank frame.
    this.canvas.width = width;
    this.canvas.height = height;
    this.draw();
  }

  // The browser may take the GPU context away (driver reset, too many contexts).
  // Calling preventDefault() asks it to give the context back later.
  private onContextLost = (event: Event): void => {
    event.preventDefault();
    cancelAnimationFrame(this.frameRequest);
    this.frameRequest = 0;
    this.program = null;
  };

  private onContextRestored = (): void => {
    const renderer = Renderer.create(this.canvas);
    if (!renderer) return;
    this.renderer = renderer;
    if (this.lastValid) this.setCode(this.lastValid.code, this.lastValid.helpers);
  };
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
