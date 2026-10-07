import { useId, type ReactNode } from 'react';
import { displayedScore } from '../engine/score';
import { ShaderCanvas } from './ShaderCanvas';
import styles from './TargetPanel.module.css';

export interface TargetPanelProps {
  /** Code of the target image (the lesson's solution). */
  code: string;
  helpers?: string[];
  /** Similarity of the learner's image to the target, 0 to 100, or null while unknown. */
  score: number | null;
  /** Similarity needed to solve the lesson. */
  threshold: number;
  /** Solved in an earlier visit or in this one, as saved in the learner's progress. */
  solved: boolean;
  /** Message shown when the learner's image reaches the target. */
  success: string;
  /** Shown under the success message, e.g. a link to the next lesson. */
  children?: ReactNode;
}

export function TargetPanel({
  code,
  helpers,
  score,
  threshold,
  solved,
  success,
  children,
}: TargetPanelProps) {
  const labelId = useId();
  const shown = score === null ? null : displayedScore(score);
  const reached = score !== null && score >= threshold;

  return (
    <section className={styles.targetPanel} aria-label="Target">
      <figure className={styles.target}>
        <ShaderCanvas code={code} helpers={helpers} label="Target image to reproduce" />
        <figcaption>Target</figcaption>
      </figure>

      <div className={styles.meterArea}>
        <div className={styles.meterHead}>
          <span id={labelId}>Similarity to the target</span>
          <strong>{shown === null ? '–' : `${shown}%`}</strong>
        </div>
        <div
          className={styles.meter}
          role="meter"
          aria-labelledby={labelId}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={shown ?? 0}
        >
          <div
            className={reached ? `${styles.fill} ${styles.done}` : styles.fill}
            style={{ width: `${shown ?? 0}%` }}
          />
        </div>

        <div role="status">
          {reached ? (
            <div className={styles.success}>
              <p>{success}</p>
              {children}
            </div>
          ) : (
            solved && <p className={styles.solvedBefore}>You already solved this lesson.</p>
          )}
        </div>
      </div>
    </section>
  );
}
