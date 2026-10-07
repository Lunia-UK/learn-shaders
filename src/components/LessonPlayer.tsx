// The interactive part of a lesson page: the learner's image with its tools and the target
// (the "stage"), and the code. Returns two sections that LessonLayout places in its grid.
import { useId, useMemo, useState, useSyncExternalStore } from 'react';
import type { ExplainedError } from '../engine/explain';
import { formatValue, probeAnnotations, type ProbeReading } from '../engine/probe';
import { progress } from '../lessons/progress';
import type { LessonData } from '../lessons/schema';
import { CodeView } from './CodeView';
import { CompileErrors } from './CompileErrors';
import { HandlesOverlay } from './HandlesOverlay';
import styles from './LessonPlayer.module.css';
import { ShaderCanvas } from './ShaderCanvas';
import { TargetPanel } from './TargetPanel';

export interface LessonPlayerProps {
  lessonId: string;
  starter: string;
  solution: string;
  scrub: LessonData['editor']['scrub'];
  readOnly: boolean;
  /** In read-only code, the one line (1-based) the learner writes, or null. */
  writableLine: number | null;
  tools: LessonData['tools'];
  handles: string[];
  threshold: number;
  success: string;
  next: { href: string; title: string } | null;
}

function helpText(locked: boolean, writableLine: number | null): string {
  const scrubbing =
    'Drag the pink numbers left or right (hold Shift for finer steps), or Tab to a number and use the arrow keys.';
  if (!locked) {
    return 'Type anywhere in the code: the image updates as soon as it compiles. The pink numbers can be dragged too.';
  }
  if (writableLine !== null) return `Write line ${writableLine} in the dashed box. ${scrubbing}`;
  return scrubbing;
}

export function LessonPlayer({
  lessonId,
  starter,
  solution,
  scrub,
  readOnly,
  writableLine,
  tools,
  handles,
  threshold,
  success,
  next,
}: LessonPlayerProps) {
  const codeHeadingId = useId();
  const hasProbe = tools.includes('probe');
  const hasHandles = tools.includes('handles');

  const [code, setCode] = useState(starter);
  // Free edit unlocks the whole code, for learners who want to go further than the lesson.
  const [freeEdit, setFreeEdit] = useState(false);
  const locked = readOnly && !freeEdit;
  const [errors, setErrors] = useState<ExplainedError[]>([]);
  const [score, setScore] = useState<number | null>(null);
  // With handles in the middle of the image, the probe starts in a corner so they do not overlap.
  const [probe, setProbe] = useState<[number, number]>(hasHandles ? [0.25, 0.75] : [0.5, 0.5]);
  const [reading, setReading] = useState<ProbeReading | null>(null);

  const solved = useSyncExternalStore(
    progress.subscribe,
    () => progress.isSolved(lessonId),
    () => false,
  );
  const annotations = useMemo(() => (reading ? probeAnnotations(reading) : []), [reading]);
  const errorLines = useMemo(
    () => errors.flatMap((error) => (error.line === null ? [] : [error.line])),
    [errors],
  );

  function updateScore(next: number | null) {
    setScore(next);
    if (next !== null && next >= threshold) progress.markSolved(lessonId);
  }

  return (
    <>
      <section className={styles.stage} aria-label="Your image and the target">
        <div className={styles.view}>
          <ShaderCanvas
            code={code}
            label="Your image"
            showErrors={false}
            onErrors={setErrors}
            target={solution}
            onScore={updateScore}
            probe={hasProbe ? probe : undefined}
            onProbeMove={hasProbe ? setProbe : undefined}
            onProbe={hasProbe ? setReading : undefined}
          >
            {hasHandles && <HandlesOverlay code={code} names={handles} onChange={setCode} />}
          </ShaderCanvas>
        </div>
        {hasProbe && (
          <p className={styles.help}>
            Probed pixel: <code>uv = ({probe.map(formatValue).join(', ')})</code>. Click or drag on
            the image to choose another one: its values show in the code.
          </p>
        )}
        <TargetPanel
          code={solution}
          score={score}
          threshold={threshold}
          solved={solved}
          success={success}
        >
          {next && (
            <a className="btn btn-primary" href={next.href}>
              Next lesson: {next.title}
            </a>
          )}
        </TargetPanel>
      </section>

      <section className={styles.code} aria-labelledby={codeHeadingId}>
        <div className={styles.codeHead}>
          <h2 id={codeHeadingId}>Your code</h2>
          <div className={styles.codeActions}>
            {readOnly && (
              <button
                type="button"
                className="btn"
                aria-pressed={freeEdit}
                onClick={() => setFreeEdit(!freeEdit)}
              >
                {freeEdit ? 'Back to guided mode' : 'Edit all the code'}
              </button>
            )}
            <button type="button" className="btn" onClick={() => setCode(starter)}>
              Start over
            </button>
          </div>
        </div>
        <CodeView
          code={code}
          onChange={setCode}
          scrub={freeEdit ? 'all' : scrub}
          readOnly={locked}
          writableLine={locked ? writableLine : null}
          annotations={annotations}
          errorLines={errorLines}
        />
        <CompileErrors errors={errors} />
        <p className={styles.help}>{helpText(locked, writableLine)}</p>
      </section>
    </>
  );
}
