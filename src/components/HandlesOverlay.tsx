import { useMemo, type KeyboardEvent, type PointerEvent } from 'react';
import { findVec2Handles, moveVec2Handle } from '../engine/glsl-parse';
import { formatValue } from '../engine/probe';
import styles from './HandlesOverlay.module.css';

export interface HandlesOverlayProps {
  code: string;
  /** Names of the `vec2 name = vec2(x, y);` declarations to show as handles. */
  names: string[];
  /** Receives the code with the moved handle's numbers rewritten. */
  onChange: (code: string) => void;
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

/**
 * Sits on top of a ShaderCanvas (as its child). Each listed vec2 becomes a point the learner
 * drags on the image; the code's two numbers follow. Handles stay inside the image (0 to 1).
 */
export function HandlesOverlay({ code, names, onChange }: HandlesOverlayProps) {
  const handles = useMemo(
    () => findVec2Handles(code).filter((handle) => names.includes(handle.name)),
    [code, names],
  );

  function move(name: string, x: number, y: number) {
    const handle = handles.find((h) => h.name === name);
    if (handle) onChange(moveVec2Handle(code, handle, clamp01(x), clamp01(y)));
  }

  function moveToPointer(event: PointerEvent<HTMLButtonElement>, name: string) {
    // The layer covers the whole image, so its box converts the pointer to uv.
    const box = event.currentTarget.parentElement!.getBoundingClientRect();
    move(name, (event.clientX - box.left) / box.width, 1 - (event.clientY - box.top) / box.height);
  }

  return (
    <div className={styles.layer}>
      {handles.map((handle) => {
        const x = clamp01(handle.x.value);
        const y = clamp01(handle.y.value);

        function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
          if (event.button !== 0) return;
          // Keep receiving the pointer even when it moves faster than the handle follows.
          event.currentTarget.setPointerCapture(event.pointerId);
        }

        function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
          if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            moveToPointer(event, handle.name);
          }
        }

        function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
          const direction = KEY_MOVES[event.key];
          if (!direction) return;
          event.preventDefault();
          const step = event.shiftKey ? BIG_KEY_STEP : KEY_STEP;
          move(handle.name, x + direction[0] * step, y + direction[1] * step);
        }

        return (
          <button
            key={handle.name}
            type="button"
            className={styles.handle}
            style={{ left: `${x * 100}%`, top: `${(1 - y) * 100}%` }}
            aria-label={`${handle.name} at (${formatValue(x)}, ${formatValue(y)}). Drag it, or use the arrow keys.`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onKeyDown={onKeyDown}
          >
            <span className={styles.name} aria-hidden="true">
              {handle.name}
            </span>
          </button>
        );
      })}
    </div>
  );
}
