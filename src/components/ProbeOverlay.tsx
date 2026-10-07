import type { KeyboardEvent, PointerEvent } from 'react';
import { formatValue } from '../engine/probe';
import styles from './ProbeOverlay.module.css';

export interface ProbeOverlayProps {
  /** Probed pixel, as uv: (0, 0) bottom-left, (1, 1) top-right. */
  position: [number, number];
  onMove: (position: [number, number]) => void;
}

/** Arrow key steps, in uv units. Shift makes bigger steps. */
const KEY_STEP = 0.01;
const BIG_KEY_STEP = 0.05;
const KEY_MOVES: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, 1],
  ArrowDown: [0, -1],
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Sits on top of a ShaderCanvas: click or drag to choose the probed pixel, or use the arrow keys. */
export function ProbeOverlay({ position, onMove }: ProbeOverlayProps) {
  const [x, y] = position;

  function moveToPointer(event: PointerEvent<HTMLDivElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    // Screen y grows downward, uv.y grows upward.
    onMove([
      clamp01((event.clientX - box.left) / box.width),
      clamp01(1 - (event.clientY - box.top) / box.height),
    ]);
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    moveToPointer(event);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) moveToPointer(event);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const move = KEY_MOVES[event.key];
    if (!move) return;
    event.preventDefault();
    const step = event.shiftKey ? BIG_KEY_STEP : KEY_STEP;
    onMove([clamp01(x + move[0] * step), clamp01(y + move[1] * step)]);
  }

  return (
    <div className={styles.overlay} onPointerDown={onPointerDown} onPointerMove={onPointerMove}>
      <button
        type="button"
        className={styles.marker}
        style={{ left: `${x * 100}%`, top: `${(1 - y) * 100}%` }}
        aria-label={`Pixel probe at uv (${formatValue(x)}, ${formatValue(y)}). Arrow keys move it.`}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}
