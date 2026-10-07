// Look of the code editor. Colors come from src/styles/tokens.css, so light and dark both work.
import { EditorView } from '@codemirror/view';

export const editorTheme = EditorView.theme({
  '&': {
    color: 'var(--ink)',
    backgroundColor: 'var(--code-bg)',
    border: '1px solid var(--line)',
    borderRadius: '12px',
    fontSize: '14px',
  },
  '&.cm-focused': {
    outline: '2px solid var(--accent)',
    outlineOffset: '2px',
  },
  '.cm-scroller': {
    fontFamily: 'var(--code-font)',
    lineHeight: '1.75',
  },
  '.cm-content': {
    padding: '14px 0',
    caretColor: 'var(--ink)',
  },
  '.cm-line': {
    padding: '0 16px 0 4px',
  },
  '.cm-gutters': {
    backgroundColor: 'transparent',
    color: 'var(--code-comment)',
    border: 'none',
    paddingLeft: '8px',
  },
  '.cm-activeLine, .cm-activeLineGutter': {
    backgroundColor: 'transparent',
  },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
    backgroundColor: 'var(--code-number-bg)',
  },
});
