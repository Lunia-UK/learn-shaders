// Dev check for the target and score (PLAN 0.8), on a real lesson.
// Used by /dev/target and tests/e2e/target.spec.ts.
import { useState, useSyncExternalStore } from 'react';
import { progress } from '../../lessons/progress';
import { CodeView } from '../CodeView';
import { ShaderCanvas } from '../ShaderCanvas';
import { TargetPanel } from '../TargetPanel';

export interface TargetCheckProps {
  lessonId: string;
  starter: string;
  solution: string;
  scrub: 'all' | string[];
  threshold: number;
  success: string;
}

export function TargetCheck({
  lessonId,
  starter,
  solution,
  scrub,
  threshold,
  success,
}: TargetCheckProps) {
  const [code, setCode] = useState(starter);
  const [score, setScore] = useState<number | null>(null);
  // On the server nothing is solved yet; the browser then reads the saved progress.
  const solved = useSyncExternalStore(
    progress.subscribe,
    () => progress.isSolved(lessonId),
    () => false,
  );

  function updateScore(next: number | null) {
    setScore(next);
    if (next !== null && next >= threshold) progress.markSolved(lessonId);
  }

  return (
    <div style={{ display: 'grid', gap: '1.25rem', gridTemplateColumns: 'minmax(0, 1fr) 260px' }}>
      <div style={{ display: 'grid', gap: '1.25rem', alignContent: 'start' }}>
        <CodeView code={code} onChange={setCode} scrub={scrub} readOnly />
        <TargetPanel
          code={solution}
          score={score}
          threshold={threshold}
          solved={solved}
          success={success}
        />
      </div>
      <ShaderCanvas code={code} target={solution} onScore={updateScore} label="Your image" />
    </div>
  );
}
