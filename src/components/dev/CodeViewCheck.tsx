// Dev check for CodeView (PLAN 0.6): scrub the numbers, see the render follow.
// Used by /dev/code and tests/e2e/code-view.spec.ts.
import { useMemo, useState } from 'react';
import type { ExplainedError } from '../../engine/explain';
import type { ShaderView } from '../../engine/view';
import { CodeView } from '../CodeView';
import { ShaderCanvas } from '../ShaderCanvas';

const START = `vec3 color(vec2 uv) {
  float red = 0.20;
  float green = 0.40;
  float blue = 0.90;
  float unused = 0.50;
  return vec3(red, green, blue);
}`;

const SCRUB = ['red', 'green', 'blue'];

function exposeView(view: ShaderView | null) {
  // Lets the e2e tests capture pixels.
  (window as Window & { shaderView?: ShaderView | null }).shaderView = view;
}

export function CodeViewCheck() {
  const [code, setCode] = useState(START);
  const [freeEdit, setFreeEdit] = useState(false);
  const [errors, setErrors] = useState<ExplainedError[]>([]);
  const errorLines = useMemo(
    () => errors.flatMap((error) => (error.line === null ? [] : [error.line])),
    [errors],
  );

  return (
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'minmax(0, 1fr) 200px' }}>
      <div style={{ display: 'grid', gap: '0.75rem', alignContent: 'start' }}>
        <CodeView
          code={code}
          onChange={setCode}
          scrub={freeEdit ? 'all' : SCRUB}
          readOnly={!freeEdit}
          errorLines={errorLines}
        />
        <label>
          <input
            type="checkbox"
            checked={freeEdit}
            onChange={(event) => setFreeEdit(event.target.checked)}
          />{' '}
          Free edit (type anywhere, every number scrubs)
        </label>
        <output data-testid="code" style={{ display: 'none' }}>
          {code}
        </output>
      </div>
      <ShaderCanvas
        code={code}
        onView={exposeView}
        onErrors={setErrors}
        label="Shader under test"
      />
    </div>
  );
}
