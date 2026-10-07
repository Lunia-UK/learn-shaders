import { useCallback, useEffect, useEffectEvent, useState, useSyncExternalStore } from 'react';
import type { ExplainedError } from '../engine/explain';
import type { ProbeReading } from '../engine/probe';
import { ShaderView, type ShaderViewState } from '../engine/view';
import { CodeText } from './CodeText';
import { ProbeOverlay } from './ProbeOverlay';
import styles from './ShaderCanvas.module.css';

export interface ShaderCanvasProps {
  /** Lesson code defining `vec3 color(vec2 uv)`. */
  code: string;
  /** Shared GLSL helpers. Pass the same array between renders (a constant or a memo). */
  helpers?: string[];
  /** Accessible name of the image. */
  label?: string;
  /** Width divided by height. */
  aspectRatio?: number;
  /** Show compile errors under the canvas. Turn off when another component shows them. */
  showErrors?: boolean;
  /** Called after each compile with the errors found (an empty list when the code compiled). */
  onErrors?: (errors: ExplainedError[]) => void;
  /** Gives access to the underlying view, for tools such as the export. */
  onView?: (view: ShaderView | null) => void;
  /** Pixel probe position (uv). Leave out to hide the probe. */
  probe?: [number, number];
  /** Called when the learner moves the probe; required for the probe to be shown. */
  onProbeMove?: (position: [number, number]) => void;
  /** Called with the values at the probed pixel each time they change. */
  onProbe?: (reading: ProbeReading | null) => void;
  /** Code of the image to reproduce. With it, the canvas scores the code against it. */
  target?: string;
  /** Called with the similarity to the target (0 to 100) after each successful compile. */
  onScore?: (score: number | null) => void;
}

const NO_HELPERS: string[] = [];
const NOT_READY: ShaderViewState = {
  errors: [],
  animated: false,
  playing: false,
  probe: null,
  score: null,
};
const noSubscription = () => () => {};

export function ShaderCanvas({
  code,
  helpers = NO_HELPERS,
  label = 'Shader output',
  aspectRatio = 1,
  showErrors = true,
  onErrors,
  onView,
  probe,
  onProbeMove,
  onProbe,
  target,
  onScore,
}: ShaderCanvasProps) {
  const [view, setView] = useState<ShaderView | null>(null);
  const [supported, setSupported] = useState(true);

  // Runs when the frame is added to the page, and its cleanup when it is removed.
  // The canvas is created here rather than in JSX: once dispose() releases a WebGL context,
  // that canvas cannot get a new one, so every mount needs a fresh canvas.
  const attachFrame = useCallback((frame: HTMLDivElement) => {
    const canvas = document.createElement('canvas');
    canvas.className = styles.canvas;
    canvas.setAttribute('role', 'img');
    frame.prepend(canvas);

    const created = ShaderView.create(canvas);
    if (!created) {
      canvas.remove();
      setSupported(false);
      return;
    }
    setView(created);
    return () => {
      created.dispose();
      canvas.remove();
      setView(null);
    };
  }, []);

  // Re-render when the view's state (errors, animated, playing) changes.
  const state = useSyncExternalStore(
    view ? view.subscribe : noSubscription,
    () => view?.state ?? NOT_READY,
    () => NOT_READY,
  );

  useEffect(() => {
    view?.setCode(code, helpers);
  }, [view, code, helpers]);

  useEffect(() => {
    view?.canvas.setAttribute('aria-label', label);
  }, [view, label]);

  // Effect events read the latest callback props without making the effects re-run.
  const reportErrors = useEffectEvent((errors: ExplainedError[]) => onErrors?.(errors));
  useEffect(() => {
    if (view) reportErrors(state.errors);
  }, [view, state.errors]);

  const reportView = useEffectEvent((current: ShaderView | null) => onView?.(current));
  useEffect(() => {
    reportView(view);
  }, [view]);

  useEffect(() => {
    view?.setProbe(probe ?? null);
  }, [view, probe]);

  const reportProbe = useEffectEvent((reading: ProbeReading | null) => onProbe?.(reading));
  useEffect(() => {
    if (view) reportProbe(state.probe);
  }, [view, state.probe]);

  useEffect(() => {
    view?.setTarget(target ?? null, helpers);
  }, [view, target, helpers]);

  const reportScore = useEffectEvent((score: number | null) => onScore?.(score));
  useEffect(() => {
    if (view) reportScore(state.score);
  }, [view, state.score]);

  return (
    <div className={styles.shaderCanvas}>
      <div ref={attachFrame} className={styles.frame} style={{ aspectRatio }}>
        {supported && probe && onProbeMove && (
          <ProbeOverlay position={probe} onMove={onProbeMove} />
        )}
        {!supported && (
          <p className={styles.unsupported}>
            This browser cannot show shaders: WebGL2 is not available. A recent version of Chrome,
            Firefox, Edge or Safari will work.
          </p>
        )}
        {state.animated && (
          <button
            type="button"
            className={styles.playButton}
            onClick={() => view?.setPlaying(!state.playing)}
            aria-label={state.playing ? 'Pause animation' : 'Play animation'}
          >
            {state.playing ? 'Pause' : 'Play'}
          </button>
        )}
      </div>

      {showErrors && state.errors.length > 0 && (
        <div className={styles.errors} role="status">
          <p className={styles.errorsIntro}>
            The image shows your last working code. To update it, fix this:
          </p>
          <ul>
            {state.errors.map((error, i) => (
              <li key={i}>
                {error.line !== null && <strong>Line {error.line}: </strong>}
                <CodeText text={error.text} />
                {error.text !== error.compilerMessage && (
                  <span className={styles.compilerMessage}>
                    Compiler says: <code>{error.compilerMessage}</code>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
