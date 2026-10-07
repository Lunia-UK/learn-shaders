import { useSyncExternalStore } from 'react';
import { progress } from '../lessons/progress';
import styles from './ChapterProgress.module.css';

export interface ChapterProgressProps {
  lessons: { id: string; number: number; title: string; href: string }[];
  currentId: string;
}

// The server cannot know what this browser solved; the dots get their marks once the page runs.
const serverSnapshot = () => '';

/** One numbered link per lesson of the chapter, with a mark on the solved ones. */
export function ChapterProgress({ lessons, currentId }: ChapterProgressProps) {
  // A string snapshot, so React can tell when it changes.
  const solvedIds = useSyncExternalStore(
    progress.subscribe,
    () =>
      lessons
        .filter((lesson) => progress.isSolved(lesson.id))
        .map((lesson) => lesson.id)
        .join(' '),
    serverSnapshot,
  );
  const solved = new Set(solvedIds.split(' '));

  return (
    <nav aria-label="Lessons in this chapter">
      <ol className={styles.lessons}>
        {lessons.map((lesson) => {
          const isSolved = solved.has(lesson.id);
          const isCurrent = lesson.id === currentId;
          return (
            <li key={lesson.id}>
              <a
                href={lesson.href}
                className={isSolved ? `${styles.lesson} ${styles.solved}` : styles.lesson}
                aria-current={isCurrent ? 'page' : undefined}
                aria-label={`Lesson ${lesson.number}: ${lesson.title}${isSolved ? ' (solved)' : ''}`}
                title={lesson.title}
              >
                {lesson.number}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
