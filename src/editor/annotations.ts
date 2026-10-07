// Values shown at the end of code lines, such as the pixel probe readings ("= 0.20").
import { StateEffect, StateField, type EditorState } from '@codemirror/state';
import { Decoration, EditorView, WidgetType, type DecorationSet } from '@codemirror/view';
import type { LineAnnotation } from '../engine/probe';

/** Replaces all the annotations at once. */
export const setAnnotations = StateEffect.define<LineAnnotation[]>();

class ValueWidget extends WidgetType {
  constructor(readonly annotation: LineAnnotation) {
    super();
  }

  // Same text and color: CodeMirror keeps the existing element instead of redrawing it.
  eq(other: ValueWidget): boolean {
    return (
      other.annotation.text === this.annotation.text &&
      other.annotation.swatch?.join() === this.annotation.swatch?.join()
    );
  }

  toDOM(): HTMLElement {
    const value = document.createElement('span');
    value.className = 'cm-value';
    const { swatch, text } = this.annotation;
    if (swatch) {
      const chip = document.createElement('span');
      chip.className = 'cm-value-swatch';
      const [r, g, b] = swatch.map((channel) => Math.round(channel * 255));
      chip.style.backgroundColor = `rgb(${r} ${g} ${b})`;
      value.append(chip);
    }
    value.append(text);
    return value;
  }
}

function build(state: EditorState, annotations: LineAnnotation[]): DecorationSet {
  const widgets = annotations
    .filter((annotation) => annotation.line >= 1 && annotation.line <= state.doc.lines)
    .map((annotation) =>
      Decoration.widget({ widget: new ValueWidget(annotation), side: 1 }).range(
        state.doc.line(annotation.line).to,
      ),
    );
  return Decoration.set(widgets, true);
}

const annotationField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(annotations, transaction) {
    for (const effect of transaction.effects) {
      if (effect.is(setAnnotations)) return build(transaction.state, effect.value);
    }
    // Until new values arrive, keep the old ones next to their lines.
    return annotations.map(transaction.changes);
  },
  provide: (field) => EditorView.decorations.from(field),
});

const annotationTheme = EditorView.baseTheme({
  '.cm-value': {
    marginLeft: '2em',
    padding: '2px 9px',
    borderRadius: '999px',
    backgroundColor: 'var(--panel)',
    border: '1px solid var(--line)',
    color: 'var(--muted)',
    fontSize: '12px',
    whiteSpace: 'nowrap',
  },
  '.cm-value-swatch': {
    display: 'inline-block',
    width: '10px',
    height: '10px',
    marginRight: '6px',
    border: '1px solid var(--line)',
    borderRadius: '3px',
    verticalAlign: '-1px',
  },
});

export const lineAnnotations = [annotationField, annotationTheme];
