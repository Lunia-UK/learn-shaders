import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { Annotation, Compartment, EditorState, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { LineAnnotation } from '../engine/probe';
import { lineAnnotations, setAnnotations } from '../editor/annotations';
import { glsl } from '../editor/glsl';
import { scrubNumbers } from '../editor/scrub';
import { editorTheme } from '../editor/theme';
import '../styles/tokens.css';
import styles from './CodeView.module.css';

export interface CodeViewProps {
  code: string;
  onChange?: (code: string) => void;
  /** Declarations whose numbers can be scrubbed, or "all". Pass the same array between renders. */
  scrub?: 'all' | string[];
  /** Lock the text: only the scrubbable numbers can change, and they become keyboard sliders. */
  readOnly?: boolean;
  /** Accessible name of the code area. */
  label?: string;
  /** Values to show at the end of lines, such as pixel probe readings. */
  annotations?: LineAnnotation[];
}

const NO_ANNOTATIONS: LineAnnotation[] = [];

/** Marks changes that come from the `code` prop, so they are not reported back through onChange. */
const fromProps = Annotation.define<boolean>();

const editableConfig = new Compartment();
const scrubConfig = new Compartment();
const labelConfig = new Compartment();

function editableExtensions(readOnly: boolean): Extension {
  return [EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)];
}

function scrubExtensions(scrub: 'all' | string[], readOnly: boolean): Extension {
  return scrubNumbers({ scrub, keyboard: readOnly });
}

function labelExtensions(label: string): Extension {
  return EditorView.contentAttributes.of({ 'aria-label': label });
}

export function CodeView({
  code,
  onChange,
  scrub = 'all',
  readOnly = false,
  label = 'Shader code',
  annotations = NO_ANNOTATIONS,
}: CodeViewProps) {
  const [view, setView] = useState<EditorView | null>(null);
  // Props as they were when the editor was created; later changes are applied by the effects below.
  const initialProps = useRef({ code, scrub, readOnly, label });
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Creates the editor once, when its container is added to the page.
  const attachEditor = useCallback((parent: HTMLDivElement) => {
    const { code, scrub, readOnly, label } = initialProps.current;
    const editor = new EditorView({
      parent,
      state: EditorState.create({
        doc: code,
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          glsl,
          editorTheme,
          lineAnnotations,
          editableConfig.of(editableExtensions(readOnly)),
          scrubConfig.of(scrubExtensions(scrub, readOnly)),
          labelConfig.of(labelExtensions(label)),
          EditorView.updateListener.of((update) => {
            const external = update.transactions.some((t) => t.annotation(fromProps));
            if (update.docChanged && !external) onChangeRef.current?.(update.state.doc.toString());
          }),
        ],
      }),
    });
    setView(editor);
    return () => {
      editor.destroy();
      setView(null);
    };
  }, []);

  // Layout effects run before the browser paints, so new props never show a stale frame.
  useLayoutEffect(() => {
    if (!view || view.state.doc.toString() === code) return;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: code },
      annotations: fromProps.of(true),
    });
  }, [view, code]);

  useLayoutEffect(() => {
    view?.dispatch({
      effects: [
        editableConfig.reconfigure(editableExtensions(readOnly)),
        scrubConfig.reconfigure(scrubExtensions(scrub, readOnly)),
      ],
    });
  }, [view, scrub, readOnly]);

  useLayoutEffect(() => {
    view?.dispatch({ effects: labelConfig.reconfigure(labelExtensions(label)) });
  }, [view, label]);

  useLayoutEffect(() => {
    view?.dispatch({ effects: setAnnotations.of(annotations) });
  }, [view, annotations]);

  return <div ref={attachEditor} className={styles.codeView} />;
}
