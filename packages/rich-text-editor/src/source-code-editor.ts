/**
 * CodeMirror 6 HTML source surface with a textarea-like adapter API
 * (value, selectionStart/End, setSelectionRange, focus, input/blur/paste).
 */
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { html } from '@codemirror/lang-html';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { Compartment, EditorState } from '@codemirror/state';
import {
  drawSelection,
  EditorView,
  keymap,
  lineNumbers,
  placeholder as cmPlaceholder,
} from '@codemirror/view';
import { tags } from '@lezer/highlight';

export type SourceEditorSurface = HTMLDivElement & {
  value: string;
  selectionStart: number;
  selectionEnd: number;
  setSelectionRange: (start: number, end: number, direction?: string) => void;
  _cmView: EditorView;
  _destroySourceEditor: () => void;
};

const lightHighlight = HighlightStyle.define([
  { tag: tags.tagName, color: '#0550ae' },
  { tag: tags.angleBracket, color: '#24292f' },
  { tag: tags.attributeName, color: '#116329' },
  { tag: tags.attributeValue, color: '#0a3069' },
  { tag: tags.string, color: '#0a3069' },
  { tag: tags.comment, color: '#6e7781', fontStyle: 'italic' },
  { tag: tags.documentMeta, color: '#6e7781' },
]);

const darkHighlight = HighlightStyle.define([
  { tag: tags.tagName, color: '#7ee787' },
  { tag: tags.angleBracket, color: '#e2e8f0' },
  { tag: tags.attributeName, color: '#79c0ff' },
  { tag: tags.attributeValue, color: '#a5d6ff' },
  { tag: tags.string, color: '#a5d6ff' },
  { tag: tags.comment, color: '#8b949e', fontStyle: 'italic' },
  { tag: tags.documentMeta, color: '#8b949e' },
]);

function isDarkTheme(): boolean {
  return document.documentElement.getAttribute('data-theme') === 'dark';
}

function highlightExtension(dark: boolean) {
  return syntaxHighlighting(dark ? darkHighlight : lightHighlight);
}

export interface CreateSourceCodeEditorOptions {
  height?: string;
  placeholder?: string;
  /** Return false or call preventDefault to handle paste yourself. */
  onPaste?: (event: ClipboardEvent) => boolean | void;
}

/**
 * Create a `.rte-source` host with CodeMirror HTML highlighting and line numbers.
 * The returned element exposes textarea-compatible value/selection helpers.
 */
export function createSourceCodeEditor(
  options: CreateSourceCodeEditorOptions = {}
): SourceEditorSurface {
  const el = document.createElement('div') as SourceEditorSurface;
  el.className = 'rte-source';
  // HTML source stays LTR even when the editor host is dir="rtl".
  el.dir = 'ltr';
  el.style.direction = 'ltr';
  el.style.textAlign = 'left';
  el.style.display = 'none';
  if (options.height) {
    el.style.minHeight = options.height;
  }

  let suppressDocNotify = false;
  const highlightConf = new Compartment();

  const themeExt = EditorView.theme({
    '&': {
      height: '100%',
      fontSize: '13px',
      backgroundColor: 'transparent',
      direction: 'ltr',
    },
    '.cm-scroller': {
      fontFamily:
        "'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace",
      lineHeight: '1.5',
      fontSize: '13px',
      direction: 'ltr',
    },
    '.cm-content': {
      padding: '12px 0',
      caretColor: 'inherit',
      direction: 'ltr',
      textAlign: 'left',
    },
    '.cm-line': {
      direction: 'ltr',
      textAlign: 'left',
      unicodeBidi: 'isolate',
    },
    '.cm-gutters': {
      borderRight: '1px solid var(--rte-source-gutter-border, #dee2e6)',
      backgroundColor: 'var(--rte-source-gutter-bg, transparent)',
      color: 'var(--rte-source-gutter-fg, #6c757d)',
    },
    '&.cm-focused': {
      outline: 'none',
    },
  });

  const updateListener = EditorView.updateListener.of((update) => {
    if (suppressDocNotify) {
      return;
    }
    if (update.docChanged) {
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }
  });

  const pasteHandler = EditorView.domEventHandlers({
    paste(event) {
      if (typeof options.onPaste === 'function') {
        const result = options.onPaste(event);
        if (result === false || event.defaultPrevented) {
          return true;
        }
      }
      return false;
    },
    blur() {
      el.dispatchEvent(new Event('blur', { bubbles: true }));
      return false;
    },
  });

  const state = EditorState.create({
    doc: '',
    extensions: [
      lineNumbers(),
      drawSelection(),
      history(),
      html(),
      EditorView.editorAttributes.of({ dir: 'ltr' }),
      EditorView.contentAttributes.of({ dir: 'ltr' }),
      highlightConf.of(highlightExtension(isDarkTheme())),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      themeExt,
      updateListener,
      pasteHandler,
      EditorView.lineWrapping,
      cmPlaceholder(options.placeholder || 'Enter HTML content here...'),
    ],
  });

  const view = new EditorView({
    state,
    parent: el,
  });

  el._cmView = view;

  Object.defineProperty(el, 'value', {
    configurable: true,
    enumerable: true,
    get() {
      return view.state.doc.toString();
    },
    set(next: string) {
      const text = next ?? '';
      const cur = view.state.doc.toString();
      if (cur === text) {
        return;
      }
      suppressDocNotify = true;
      try {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: text },
        });
      } finally {
        suppressDocNotify = false;
      }
    },
  });

  Object.defineProperty(el, 'selectionStart', {
    configurable: true,
    enumerable: true,
    get() {
      return view.state.selection.main.from;
    },
  });

  Object.defineProperty(el, 'selectionEnd', {
    configurable: true,
    enumerable: true,
    get() {
      return view.state.selection.main.to;
    },
  });

  el.setSelectionRange = (start: number, end: number) => {
    const len = view.state.doc.length;
    const from = Math.max(0, Math.min(start, len));
    const to = Math.max(0, Math.min(end ?? start, len));
    view.dispatch({
      selection: { anchor: from, head: to },
      scrollIntoView: true,
    });
  };

  const nativeFocus = el.focus.bind(el);
  el.focus = (...args: Parameters<HTMLElement['focus']>) => {
    nativeFocus(...args);
    view.focus();
  };

  const syncTheme = () => {
    view.dispatch({
      effects: highlightConf.reconfigure(highlightExtension(isDarkTheme())),
    });
  };

  const themeObserver = new MutationObserver(syncTheme);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  // When shown after display:none, CodeMirror needs a measure pass
  const displayObserver = new MutationObserver(() => {
    if (el.style.display !== 'none') {
      view.requestMeasure();
      syncTheme();
    }
  });
  displayObserver.observe(el, { attributes: true, attributeFilter: ['style', 'class'] });

  el._destroySourceEditor = () => {
    themeObserver.disconnect();
    displayObserver.disconnect();
    view.destroy();
  };

  return el;
}

/** Refresh layout after show / fullscreen size changes. */
export function refreshSourceEditor(surface: SourceEditorSurface | null | undefined): void {
  if (surface?._cmView) {
    surface._cmView.requestMeasure();
  }
}
