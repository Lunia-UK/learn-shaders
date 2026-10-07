import { useEffect, useRef, useState } from 'react';
import type { ExplainedError } from '../engine/explain';
import { ShaderView } from '../engine/view';
import { CodeText } from './CodeText';
import styles from './ShaderCanvas.module.css';

export interface ShaderCanvasProps {
  /** Lesson code defining `vec3 color(vec2 uv)`. */
  code: string;
  helpers?: string[];
  /** Accessible name of the image. */
  label?: string;
  /** Width divided by height. */
  aspectRatio?: number;
  /** Show compile errors under the canvas. Turn off when another component shows them. */
  showErrors?: boolean;
  /** Called after each compile with the errors found (an empty list when the code compiled). */
  onErrors?: (errors: ExplainedError[]) => void;
  /** Gives access to the underlying view, for tools such as the probe or the export. */
  onView?: (view: ShaderView | null) => void;
}

export function ShaderCanvas({
  code,
  helpers,
  label = 'Shader output',
  aspectRatio = 1,
  showErrors = true,
  onErrors,
  onView,
}: ShaderCanvasProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [view, setView] = useState<ShaderView | null>(null);
  const [supported, setSupported] = useState(true);
  const [errors, setErrors] = useState<ExplainedError[]>([]);
  const [animated, setAnimated] = useState(false);
  const [playing, setPlaying] = useState(false);

  // The canvas is created here rather than in JSX: once dispose() releases a WebGL context,
  // that canvas cannot get a new one, so every mount needs a fresh canvas.
  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.className = styles.canvas;
    canvas.setAttribute('role', 'img');
    frameRef.current!.prepend(canvas);
    canvasRef.current = canvas;

    const created = ShaderView.create(canvas);
    if (!created) {
      canvas.remove();
      setSupported(false);
      return;
    }
    setView(created);
    setPlaying(created.isPlaying);
    return () => {
      created.dispose();
      canvas.remove();
      setView(null);
    };
  }, []);

  useEffect(() => {
    canvasRef.current?.setAttribute('aria-label', label);
  }, [label, view]);

  // onView is a callback prop: only a new view should call it, not a new callback.
  useEffect(() => {
    onView?.(view);
  }, [view]);

  // Helpers are compared by content, so a new array with the same helpers does not recompile.
  const helpersKey = helpers?.join('\n') ?? '';
  useEffect(() => {
    if (!view) return;
    const found = view.setCode(code, helpers);
    setErrors(found);
    setAnimated(view.isAnimated);
    onErrors?.(found);
  }, [view, code, helpersKey]);

  function togglePlaying() {
    if (!view) return;
    view.setPlaying(!playing);
    setPlaying(!playing);
  }

  return (
    <div className={styles.shaderCanvas}>
      <div ref={frameRef} className={styles.frame} style={{ aspectRatio }}>
        {!supported && (
          <p className={styles.unsupported}>
            This browser cannot show shaders: WebGL2 is not available. A recent version of Chrome,
            Firefox, Edge or Safari will work.
          </p>
        )}
        {animated && (
          <button
            type="button"
            className={styles.playButton}
            onClick={togglePlaying}
            aria-label={playing ? 'Pause animation' : 'Play animation'}
          >
            {playing ? 'Pause' : 'Play'}
          </button>
        )}
      </div>

      {showErrors && errors.length > 0 && (
        <div className={styles.errors} role="status">
          <p className={styles.errorsIntro}>
            The image shows your last working code. To update it, fix this:
          </p>
          <ul>
            {errors.map((error, i) => (
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
