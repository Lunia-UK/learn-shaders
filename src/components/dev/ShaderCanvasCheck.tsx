// Dev check for ShaderCanvas (PLAN 0.5): a plain textarea driving the render.
// Used by /dev/canvas and tests/e2e/shader-canvas.spec.ts.
import { useState } from 'react';
import type { ShaderView } from '../../engine/view';
import { ShaderCanvas } from '../ShaderCanvas';

const START = `vec3 color(vec2 uv) {
  return vec3(uv, 0.5);
}`;

export function ShaderCanvasCheck() {
  const [code, setCode] = useState(START);

  function exposeView(view: ShaderView | null) {
    // Lets the e2e tests capture pixels and count frames.
    (window as Window & { shaderView?: ShaderView | null }).shaderView = view;
  }

  return (
    <div id="check" style={{ display: 'grid', gap: '1rem', maxWidth: 320 }}>
      <ShaderCanvas code={code} onView={exposeView} label="Shader under test" />
      <textarea
        aria-label="Shader code"
        value={code}
        onChange={(event) => setCode(event.target.value)}
        rows={8}
        spellCheck={false}
        style={{ fontFamily: 'ui-monospace, monospace', fontSize: 14 }}
      />
    </div>
  );
}
