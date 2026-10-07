// Dev check for the pixel probe (PLAN 0.7): values of every variable at the probed pixel,
// shown at the end of each line. Used by /dev/probe and tests/e2e/probe.spec.ts.
import { useMemo, useState } from 'react';
import { probeAnnotations, type ProbeReading } from '../../engine/probe';
import type { ShaderView } from '../../engine/view';
import { CodeView } from '../CodeView';
import { ShaderCanvas } from '../ShaderCanvas';

const START = `vec3 color(vec2 uv) {
  float x = uv.x;
  vec2 center = vec2(0.50, 0.50);
  float d = distance(uv, center);
  vec3 tint = vec3(x, uv.y, 0.50);
  return tint * (1.0 - d);
}`;

type CheckWindow = Window & {
  shaderView?: ShaderView | null;
  probeReading?: ProbeReading | null;
};

function exposeView(view: ShaderView | null) {
  (window as CheckWindow).shaderView = view;
}

export function ProbeCheck() {
  const [code, setCode] = useState(START);
  const [probe, setProbe] = useState<[number, number]>([0.25, 0.75]);
  const [reading, setReading] = useState<ProbeReading | null>(null);
  const annotations = useMemo(() => (reading ? probeAnnotations(reading) : []), [reading]);

  function showReading(next: ProbeReading | null) {
    // Lets the e2e tests compare the raw values with the expected ones.
    (window as CheckWindow).probeReading = next;
    setReading(next);
  }

  return (
    <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'minmax(0, 1fr) 240px' }}>
      <CodeView code={code} onChange={setCode} annotations={annotations} />
      <ShaderCanvas
        code={code}
        onView={exposeView}
        label="Shader under test"
        probe={probe}
        onProbeMove={setProbe}
        onProbe={showReading}
      />
    </div>
  );
}
