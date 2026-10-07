// Highlights the lines a compile error points to.
import { StateEffect, StateField, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';

/** Replaces the highlighted lines (1-based). */
export const setErrorLines = StateEffect.define<number[]>();

const errorLine = Decoration.line({ class: 'cm-error-line' });

function build(state: EditorState, lines: number[]): DecorationSet {
  const valid = [...new Set(lines)].filter((line) => line >= 1 && line <= state.doc.lines);
  valid.sort((a, b) => a - b);
  return Decoration.set(valid.map((line) => errorLine.range(state.doc.line(line).from)));
}

const errorLineField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(lines, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setErrorLines)) return build(transaction.state, effect.value);
    }
    return lines.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

const errorLineTheme = EditorView.baseTheme({
  '.cm-error-line': {
    backgroundColor: 'color-mix(in srgb, var(--err) 14%, transparent)',
  },
});

export const errorLines = [errorLineField, errorLineTheme];
