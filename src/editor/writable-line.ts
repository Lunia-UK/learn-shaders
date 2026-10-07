// One line the learner types, in code that is otherwise locked. The line is shown as a text
// field: the editor stays read-only, and the field is the only place where typing goes.
import type { EditorState, Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';

/** Where the typed part of a line starts and ends: after its indentation, up to its end. */
function typedRange(state: EditorState, lineNumber: number) {
  const line = state.doc.line(lineNumber);
  const indent = /^\s*/.exec(line.text)![0].length;
  return { from: line.from + indent, to: line.to, text: line.text.slice(indent) };
}

/** Width of the field, in characters: room for the text and a little more, never tiny. */
const fieldSize = (text: string) => Math.max(text.length + 2, 24);

class LineField extends WidgetType {
  constructor(
    readonly text: string,
    readonly lineNumber: number,
  ) {
    super();
  }

  // Same text: CodeMirror keeps the field as it is, so it keeps the focus and the caret.
  eq(other: LineField): boolean {
    return other.text === this.text && other.lineNumber === this.lineNumber;
  }

  toDOM(view: EditorView): HTMLElement {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'cm-line-field';
    input.spellcheck = false;
    input.autocomplete = 'off';
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('aria-label', `Line ${this.lineNumber}: write this line yourself`);
    this.fill(input);
    input.addEventListener('input', () => {
      input.size = fieldSize(input.value);
      const range = typedRange(view.state, this.lineNumber);
      view.dispatch({
        changes: { from: range.from, to: range.to, insert: input.value },
        userEvent: 'input.line',
      });
    });
    return input;
  }

  // Called when the text changed from outside (Start over): update the field in place.
  updateDOM(dom: HTMLElement): boolean {
    this.fill(dom as HTMLInputElement);
    return true;
  }

  private fill(input: HTMLInputElement) {
    if (input.value !== this.text) input.value = this.text;
    input.size = fieldSize(this.text);
  }

  // Keys and clicks in the field belong to the field, not to the editor.
  ignoreEvent(): boolean {
    return true;
  }
}

function build(state: EditorState, lineNumber: number): DecorationSet {
  if (lineNumber < 1 || lineNumber > state.doc.lines) return Decoration.none;
  const range = typedRange(state, lineNumber);
  return Decoration.set([
    Decoration.line({ class: 'cm-writable-line' }).range(state.doc.line(lineNumber).from),
    Decoration.replace({ widget: new LineField(range.text, lineNumber) }).range(
      range.from,
      range.to,
    ),
  ]);
}

/** Turns line `lineNumber` (1-based) into a text field. */
export function writableLine(lineNumber: number): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view.state, lineNumber);
      }
      update(update: ViewUpdate) {
        if (update.docChanged) this.decorations = build(update.state, lineNumber);
      }
    },
    { decorations: (plugin) => plugin.decorations },
  );
  return [plugin, writableTheme];
}

const writableTheme = EditorView.baseTheme({
  '.cm-line-field': {
    minWidth: '22ch',
    margin: '0 0 0 -7px',
    padding: '0 6px',
    font: 'inherit',
    color: 'var(--ink)',
    backgroundColor: 'var(--panel)',
    border: '1.5px dashed var(--code-number)',
    borderRadius: '5px',
  },
  '.cm-line-field:focus': {
    outline: 'none',
    borderStyle: 'solid',
    boxShadow: '0 0 0 3px var(--code-number-bg)',
  },
});
