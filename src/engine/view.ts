// A live shader on a canvas: compiles lesson code, keeps the last valid program on errors,
// sizes the canvas for sharp pixels, and draws only when something changed (or every frame
// while the code uses `time`). Shared by lessons, the playground and the export preview.

import { assemble, parseCompileLog, UNIFORMS } from './assemble';
import { explainErrors, type ExplainedError } from './explain';
import { Renderer, type RenderTarget, type ShaderProgram } from './gl';
import { PixelProbe, type ProbeReading } from './probe';
import { similarity, TARGET_SIZE } from './score';

/** Above 2, extra pixels cost a lot of GPU time for a difference few people can see. */
export const MAX_PIXEL_RATIO = 2;

/** While a shader animates, the probe values refresh this often (5 times per second). */
const PROBE_INTERVAL_MS = 200;

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

/** What the page shows around the canvas. A new object each time something changes. */
export interface ShaderViewState {
  /** Errors of the last code given, explained. Empty when it compiled. */
  readonly errors: ExplainedError[];
  /** True when the code on screen uses `time`. */
  readonly animated: boolean;
  readonly playing: boolean;
  /** Values at the probed pixel, or null when the probe is off or cannot read this code. */
  readonly probe: ProbeReading | null;
  /** Similarity to the target (0 to 100), or null without a target. */
  readonly score: number | null;
}

export class ShaderView {
  /** How many times the shader was drawn. Lets tests check that idle views do not redraw. */
  framesDrawn = 0;

  readonly canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private program: ShaderProgram | null = null;
  /** The last code that compiled, to rebuild the program if the GPU context is lost. */
  private lastValid: { code: string; helpers: string[] } | null = null;
  private helpers: string[];
  private currentState: ShaderViewState;
  private readonly listeners = new Set<() => void>();
  /** Seconds of animation played so far. Pausing stops the clock instead of skipping ahead. */
  private time = 0;
  private lastTick: number | null = null;
  private frameRequest = 0;
  private readonly resizeObserver: ResizeObserver;
  private probe: PixelProbe | null = null;
  private probeUV: [number, number] | null = null;
  private lastProbeTime = 0;
  private targetCode: string | null = null;
  private targetPixels: Uint8Array | null = null;
  private scoreTarget: RenderTarget | null = null;

  /** Returns null when the browser has no WebGL2. */
  static create(canvas: HTMLCanvasElement, options: ShaderViewOptions = {}): ShaderView | null {
    const renderer = Renderer.create(canvas);
    return renderer ? new ShaderView(canvas, renderer, options) : null;
  }

  private constructor(canvas: HTMLCanvasElement, renderer: Renderer, options: ShaderViewOptions) {
    this.canvas = canvas;
    this.renderer = renderer;
    this.helpers = options.helpers ?? [];
    this.currentState = {
      errors: [],
      animated: false,
      playing: options.playing ?? !prefersReducedMotion(),
      probe: null,
      score: null,
    };

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    canvas.addEventListener('webglcontextlost', this.onContextLost);
    canvas.addEventListener('webglcontextrestored', this.onContextRestored);
  }

  get state(): ShaderViewState {
    return this.currentState;
  }

  /** Calls `listener` whenever `state` changes. Returns a function that stops listening. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /**
   * Compiles new code. On success the view switches to it; on failure it keeps drawing
   * the last valid program and returns the errors, explained.
   */
  setCode(code: string, helpers: string[] = this.helpers): ExplainedError[] {
    this.helpers = helpers;
    const shader = assemble(code, { helpers });
    const result = this.renderer.compile(shader.source);
    if (!result.ok) {
      const errors = explainErrors(parseCompileLog(result.log, shader));
      this.setState({ errors });
      return errors;
    }

    if (this.program) this.renderer.free(this.program);
    this.program = result.program;
    this.lastValid = { code, helpers };
    // The compiler drops uniforms the code never reads, so this tells whether it uses time.
    this.setState({
      errors: [],
      animated: result.program.uniforms.has(UNIFORMS.time),
      score: this.computeScore(),
    });
    if (this.probe) {
      this.probe.setCode(code, helpers);
      this.readProbe();
    }
    this.requestFrame();
    return [];
  }

  setPlaying(playing: boolean): void {
    this.setState({ playing });
    this.lastTick = null;
    this.requestFrame();
  }

  /**
   * Sets the code of the image to reproduce (a lesson's solution), or removes it with null.
   * The target is rendered once; from then on, every successful compile updates the score.
   */
  setTarget(code: string | null, helpers: string[] = this.helpers): void {
    this.targetCode = code;
    this.targetPixels = null;
    if (code !== null) {
      const result = this.renderer.compile(assemble(code, { helpers }).source);
      if (result.ok) {
        this.targetPixels = this.snapshot(result.program, TARGET_SIZE);
        this.renderer.free(result.program);
      }
    }
    this.setState({ score: this.computeScore() });
  }

  /** Probes the pixel at `uv` (0 to 1 on each axis), or turns the probe off with null. */
  setProbe(uv: [number, number] | null): void {
    this.probeUV = uv;
    if (!uv) {
      this.probe?.dispose();
      this.probe = null;
      this.setState({ probe: null });
      return;
    }
    if (!this.probe) {
      this.probe = new PixelProbe(this.renderer);
      if (this.lastValid) this.probe.setCode(this.lastValid.code, this.lastValid.helpers);
    }
    this.readProbe();
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
    this.probe?.dispose();
    this.probe = null;
    if (this.scoreTarget) this.renderer.freeTarget(this.scoreTarget);
    this.scoreTarget = null;
    this.listeners.clear();
    this.renderer.dispose();
  }

  /**
   * Renders a program offscreen at size×size, at time 0 so the result does not depend on
   * when it is taken. Returns RGBA bytes, bottom row first.
   */
  private snapshot(program: ShaderProgram, size: number): Uint8Array {
    if (this.scoreTarget?.width !== size) {
      if (this.scoreTarget) this.renderer.freeTarget(this.scoreTarget);
      this.scoreTarget = this.renderer.createTarget(size, size);
    }
    const target = this.scoreTarget;
    this.renderer.draw(program, {
      target,
      uniforms: { [UNIFORMS.resolution]: [size, size], [UNIFORMS.time]: 0 },
    });
    return this.renderer.readPixels({ target });
  }

  private computeScore(): number | null {
    if (!this.targetPixels || !this.program) return null;
    return similarity(this.snapshot(this.program, TARGET_SIZE), this.targetPixels);
  }

  private setState(changes: Partial<ShaderViewState>): void {
    this.currentState = { ...this.currentState, ...changes };
    for (const listener of this.listeners) listener();
  }

  private get running(): boolean {
    return this.currentState.animated && this.currentState.playing && this.program !== null;
  }

  private requestFrame(): void {
    if (this.frameRequest === 0) this.frameRequest = requestAnimationFrame(this.onFrame);
  }

  private onFrame = (now: number): void => {
    this.frameRequest = 0;
    if (this.running && this.lastTick !== null) this.time += (now - this.lastTick) / 1000;
    this.lastTick = this.running ? now : null;
    this.draw();
    if (this.running && now - this.lastProbeTime >= PROBE_INTERVAL_MS) this.readProbe();
    if (this.running) this.requestFrame();
  };

  private readProbe(): void {
    if (!this.probe || !this.probeUV) return;
    const reading = this.probe.read(
      this.probeUV,
      [this.canvas.width, this.canvas.height],
      this.time,
    );
    this.lastProbeTime = performance.now();
    this.setState({ probe: reading });
  }

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
    // Code that uses the resolution may now give other values.
    this.readProbe();
  }

  // The browser may take the GPU context away (driver reset, too many contexts).
  // Calling preventDefault() asks it to give the context back later.
  private onContextLost = (event: Event): void => {
    event.preventDefault();
    cancelAnimationFrame(this.frameRequest);
    this.frameRequest = 0;
    this.program = null;
    this.probe = null;
    this.scoreTarget = null;
  };

  private onContextRestored = (): void => {
    const renderer = Renderer.create(this.canvas);
    if (!renderer) return;
    this.renderer = renderer;
    if (this.probeUV) this.probe = new PixelProbe(renderer);
    if (this.lastValid) this.setCode(this.lastValid.code, this.lastValid.helpers);
    if (this.targetCode !== null) this.setTarget(this.targetCode);
  };
}

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
