// Dev check for draggable handles (PLAN 0.9): the circle level of the chapter 1 prototype.
// Used by /dev/handles and tests/e2e/handles.spec.ts.
import { useMemo, useState } from 'react';
import { probeAnnotations, type ProbeReading } from '../../engine/probe';
import { CodeView } from '../CodeView';
import { HandlesOverlay } from '../HandlesOverlay';
import { ShaderCanvas } from '../ShaderCanvas';
import { TargetPanel } from '../TargetPanel';

const STARTER = `vec3 color(vec2 uv) {
  vec2 center = vec2(0.50, 0.50);
  float d = distance(uv, center);
  float circle = 1.0 - smoothstep(0.20, 0.22, d);
  return vec3(circle);
}`;

const SOLUTION = `vec3 color(vec2 uv) {
  float d = distance(uv, vec2(0.35, 0.60));
  return vec3(1.0 - smoothstep(0.15, 0.40, d));
}`;

const HANDLES = ['center'];

export function HandlesCheck() {
  const [code, setCode] = useState(STARTER);
  const [score, setScore] = useState<number | null>(null);
  const [probe, setProbe] = useState<[number, number]>([0.5, 0.5]);
  const [reading, setReading] = useState<ProbeReading | null>(null);
  const annotations = useMemo(() => (reading ? probeAnnotations(reading) : []), [reading]);

  return (
    <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'minmax(0, 1fr) 280px' }}>
      <div style={{ display: 'grid', gap: '1.25rem', alignContent: 'start' }}>
        <CodeView code={code} onChange={setCode} readOnly annotations={annotations} />
        <TargetPanel
          code={SOLUTION}
          score={score}
          threshold={97}
          solved={false}
          success="Solved! A circle, with no drawing function at all, just a distance."
        />
        <output data-testid="code" hidden>
          {code}
        </output>
      </div>
      <ShaderCanvas
        code={code}
        target={SOLUTION}
        onScore={setScore}
        probe={probe}
        onProbeMove={setProbe}
        onProbe={setReading}
        label="Your image"
      >
        <HandlesOverlay code={code} names={HANDLES} onChange={setCode} />
      </ShaderCanvas>
    </div>
  );
}
