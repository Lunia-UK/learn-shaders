// Scrubbable numbers: drag a float literal sideways to change it, or focus it and use the arrow keys.
// Each change is a small edit of the document, so the editor is never rebuilt while scrubbing.
import { Prec, StateEffect, type Extension } from '@codemirror/state';
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from '@codemirror/view';
import {
  findDeclarations,
  formatNumber,
  literalEdit,
  scrubbableLiterals,
  type NumberLiteral,
} from '../engine/glsl-parse';

export interface ScrubOptions {
  /** Declarations whose numbers can be scrubbed, or "all". */
  scrub: 'all' | string[];
  /**
   * Make each number a focusable spin button driven by the arrow keys.
   * Meant for read-only code; in editable code the arrow keys move the cursor.
   */
  keyboard: boolean;
}

/** Pixels the pointer must travel before a press becomes a drag (a shorter press focuses). */
const DRAG_THRESHOLD = 3;
/** Value change per pixel dragged; Shift gives the fine step. */
const DRAG_STEP = 0.005;
const FINE_DRAG_STEP = 0.001;
/** Value change per key press; Shift or Page Up/Down give the big step. */
const KEY_STEP = 0.01;
const BIG_KEY_STEP = 0.1;
const KEY_DIRECTIONS: Record<string, number> = {
  ArrowUp: 1,
  ArrowRight: 1,
  PageUp: 1,
  ArrowDown: -1,
  ArrowLeft: -1,
  PageDown: -1,
};

/** Marks the number being dragged, so it keeps its highlight while its text changes. */
const setActive = StateEffect.define<number | null>();

export function scrubNumbers(options: ScrubOptions): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      literals: NumberLiteral[] = [];
      active: number | null = null;

      constructor(view: EditorView) {
        this.decorations = this.build(view);
      }

      update(update: ViewUpdate) {
        let activeChanged = false;
        for (const transaction of update.transactions) {
          for (const effect of transaction.effects) {
            if (effect.is(setActive)) {
              this.active = effect.value;
              activeChanged = true;
            }
          }
        }
        if (update.docChanged || activeChanged) this.decorations = this.build(update.view);
      }

      build(view: EditorView): DecorationSet {
        const code = view.state.doc.toString();
        this.literals = scrubbableLiterals(code, options.scrub);
        const declarations = findDeclarations(code);
        return Decoration.set(
          this.literals.map((literal) => {
            const declaration = declarations.find(
              (d) => literal.from >= d.from && literal.to <= d.to,
            );
            const siblings = declaration
              ? this.literals.filter((l) => l.from >= declaration.from && l.to <= declaration.to)
              : [];
            const name = declaration
              ? siblings.length > 1
                ? `${declaration.name}, number ${siblings.indexOf(literal) + 1} of ${siblings.length}`
                : declaration.name
              : 'Number';
            return numberMark(literal, name, options.keyboard, literal.from === this.active).range(
              literal.from,
              literal.to,
            );
          }),
        );
      }

      literalAt(element: HTMLElement): NumberLiteral | undefined {
        const from = Number(element.dataset.scrubFrom);
        return this.literals.find((literal) => literal.from === from);
      }
    },
    {
      decorations: (plugin) => plugin.decorations,
      eventHandlers: {
        pointerdown(event, view) {
          if (event.button !== 0) return false;
          const element = (event.target as Element).closest<HTMLElement>('.cm-scrub');
          const literal = element && this.literalAt(element);
          if (!literal) return false;
          // No text selection and no cursor move: this press is about the number.
          event.preventDefault();
          startDrag(view, literal, event, options.keyboard);
          return true;
        },
        keydown(event, view) {
          if (!options.keyboard) return false;
          const direction = KEY_DIRECTIONS[event.key];
          const element = (event.target as Element).closest<HTMLElement>('.cm-scrub');
          const literal = element && this.literalAt(element);
          if (direction === undefined || !literal) return false;

          event.preventDefault();
          const big = event.shiftKey || event.key.startsWith('Page');
          const value = literal.value + direction * (big ? BIG_KEY_STEP : KEY_STEP);
          const range = writeNumber(
            view,
            literal,
            formatNumber(value, Math.max(literal.decimals, 2)),
          );
          focusNumber(view, range.from);
          return true;
        },
      },
    },
  );
  // High precedence: on a focused number, the arrow keys must reach this plugin before
  // the default keymap uses them to move the cursor.
  return [Prec.high(plugin), scrubTheme];
}

function numberMark(literal: NumberLiteral, name: string, keyboard: boolean, active: boolean) {
  const attributes: Record<string, string> = { 'data-scrub-from': String(literal.from) };
  if (keyboard) {
    attributes.tabindex = '0';
    attributes.role = 'spinbutton';
    attributes['aria-label'] = name;
    attributes['aria-valuenow'] = String(literal.value);
  }
  return Decoration.mark({ class: active ? 'cm-scrub cm-scrub-active' : 'cm-scrub', attributes });
}

/** Replaces a number in the document. Returns where the number now sits. */
function writeNumber(
  view: EditorView,
  range: { from: number; to: number },
  text: string,
  keepActive = false,
): { from: number; to: number } {
  const charBefore = range.from > 0 ? view.state.sliceDoc(range.from - 1, range.from) : undefined;
  const edit = literalEdit(charBefore, range.from, text);
  view.dispatch({
    changes: { from: range.from, to: range.to, insert: edit.insert },
    effects: setActive.of(keepActive ? edit.from : null),
    userEvent: 'input.scrub',
  });
  return { from: edit.from, to: edit.to };
}

function focusNumber(view: EditorView, from: number) {
  view.contentDOM
    .querySelector<HTMLElement>(`[data-scrub-from="${from}"]`)
    ?.focus({ preventScroll: true });
}

function startDrag(
  view: EditorView,
  literal: NumberLiteral,
  down: PointerEvent,
  keyboard: boolean,
) {
  let range = { from: literal.from, to: literal.to };
  let value = literal.value;
  let lastX = down.clientX;
  let dragging = false;
  let pending: string | null = null;
  let frame = 0;

  view.dispatch({ effects: setActive.of(literal.from) });

  // Pointer events can come faster than the screen refreshes; write at most once per frame.
  const flush = () => {
    frame = 0;
    if (pending === null) return;
    range = writeNumber(view, range, pending, true);
    pending = null;
  };

  const move = (event: PointerEvent) => {
    if (!dragging) {
      if (Math.abs(event.clientX - down.clientX) < DRAG_THRESHOLD) return;
      dragging = true;
      document.documentElement.classList.add('scrubbing');
    }
    // Steps add up from the last position, so pressing or releasing Shift never makes the value jump.
    const fine = event.shiftKey;
    value += (event.clientX - lastX) * (fine ? FINE_DRAG_STEP : DRAG_STEP);
    lastX = event.clientX;
    pending = formatNumber(value, Math.max(literal.decimals, fine ? 3 : 2));
    if (frame === 0) frame = requestAnimationFrame(flush);
  };

  const end = () => {
    window.removeEventListener('pointermove', move);
    window.removeEventListener('pointerup', end);
    window.removeEventListener('pointercancel', end);
    cancelAnimationFrame(frame);
    flush();
    document.documentElement.classList.remove('scrubbing');
    view.dispatch({ effects: setActive.of(null) });
    // A press without a drag selects the number for the keyboard.
    if (!dragging && keyboard) focusNumber(view, range.from);
  };

  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
}

const scrubTheme = EditorView.baseTheme({
  '.cm-scrub': {
    color: 'var(--code-number)',
    backgroundColor: 'var(--code-number-bg)',
    borderBottom: '1.5px dashed currentColor',
    borderRadius: '3px 3px 0 0',
    cursor: 'ew-resize',
    // Vertical swipes still scroll the page on touch screens; horizontal ones scrub.
    touchAction: 'pan-y',
    userSelect: 'none',
  },
  '.cm-scrub *': {
    color: 'inherit',
  },
  '.cm-scrub:hover, .cm-scrub:focus-visible, .cm-scrub-active': {
    color: 'var(--panel)',
    backgroundColor: 'var(--code-number)',
    outline: 'none',
  },
});
