import type { ExplainedError } from '../engine/explain';
import { CodeText } from './CodeText';
import styles from './CompileErrors.module.css';

/** Compile errors in plain English, with the compiler's own words underneath. */
export function CompileErrors({ errors }: { errors: ExplainedError[] }) {
  if (errors.length === 0) return null;
  return (
    <div className={styles.errors} role="status">
      <p className={styles.intro}>
        The image shows your last working code. To update it, fix this:
      </p>
      <ul>
        {errors.map((error, i) => (
          <li key={i}>
            {error.line !== null && <strong>Line {error.line}: </strong>}
            <CodeText text={error.text} />
            {error.text !== error.compilerMessage && (
              <span className={styles.compilerMessage}>
                Compiler says: <code>{error.compilerMessage}</code>
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
