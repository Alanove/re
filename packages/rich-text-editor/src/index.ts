/**
 * Public RichTextEditor API: create / destroy / getHTML / setHTML / mountTextarea.
 */
import './namespace';
import { DEFAULT_TOOLBAR_PRESET } from './config';
import { RichTextEditorCore } from './core';
import { ensureNamespace } from './namespace';
import type { EditorFacade, EditorOptions } from './types';

// Feature mixins (side-effect: Object.assign onto Core.prototype)
import './history';
import './paste';
import './file-browser';
import './commands';
import './toolbar';
import './insert-menu';
import './table-toolbar';
import './dialogs/find-replace';
import './dialogs/link';
import './dialogs/image-panel';
import './dialogs/image-modal';
import './dialogs/image-insert';
import './dialogs/video';
import './dialogs/table';
import './dialogs/templates';
import './dialogs/preview';

const RTE = ensureNamespace();
RTE.Core = RichTextEditorCore;

let instanceSeq = 0;

/** Known preset name, or the default ('normal') for missing / unknown values. */
function resolvePresetName(name: string | null | undefined): string {
  const trimmed = (name || '').trim().toLowerCase();
  return RTE.hasToolbarPreset!(trimmed) ? trimmed : DEFAULT_TOOLBAR_PRESET;
}

RTE.create = function (containerElOrId: HTMLElement | string, options?: EditorOptions): EditorFacade {
  options = options || {};
  const el = RTE.utils.resolveElement(containerElOrId);
  if (!el) {
    throw new Error('RichTextEditor.create: container not found');
  }
  if (!el.id) {
    el.id = 'rte-host-' + (++instanceSeq);
  }
  const core = new RichTextEditorCore(el.id, options);
  const facade: EditorFacade = {
    _core: core,
    _el: el,
    getHTML() {
      return core.getHTML();
    },
    setHTML(html: string) {
      core.setHTML(html || '');
    },
    focus() {
      if (core.richTextEditor) core.richTextEditor.focus();
    },
    destroy() {
      RTE.destroy!(facade);
    },
  };
  el._rteInstance = facade;
  RTE._instances.push(facade);
  return facade;
};

RTE.destroy = function (instance: EditorFacade | null | undefined): void {
  if (!instance) return;
  if (instance._core && typeof instance._core.destroy === 'function') {
    try {
      instance._core.destroy();
    } catch {
      /* ignore */
    }
  }
  if (instance._el) {
    instance._el.innerHTML = '';
    instance._el._rteInstance = null;
  }
  const idx = RTE._instances.indexOf(instance);
  if (idx >= 0) RTE._instances.splice(idx, 1);
};

RTE.mountTextarea = function (textarea: HTMLTextAreaElement, options?: EditorOptions): EditorFacade {
  if (!textarea || textarea.nodeName !== 'TEXTAREA') {
    throw new Error('RichTextEditor.mountTextarea expects a textarea');
  }
  if (textarea._rteFacade) {
    return textarea._rteFacade;
  }

  options = options || {};
  const presetName = resolvePresetName(options.toolbarPreset || textarea.getAttribute('data-editor-tools'));
  const presetDef = RTE.getToolbarPresetDef!(presetName) || {};
  const isMini = !!presetDef.mini;

  const host = document.createElement('div');
  host.className = 'rte-host';
  if (isMini) {
    host.classList.add('rte-mini');
  }
  textarea.parentNode!.insertBefore(host, textarea);
  textarea.style.display = 'none';
  textarea.setAttribute('data-rte-bound', '1');

  const heightAttr = textarea.getAttribute('data-editor-height');
  let height = options.height as string | undefined;
  if (!height && heightAttr) {
    height = /px$/.test(heightAttr) ? heightAttr : parseInt(heightAttr, 10) + 'px';
  }

  const linesAttr = parseInt(textarea.getAttribute('data-editor-lines') || '', 10);
  let maxLines = options.maxLines as number | undefined;
  if (maxLines == null) {
    if (Number.isFinite(linesAttr) && linesAttr > 0) {
      maxLines = linesAttr;
    } else if (presetDef.maxLines) {
      maxLines = presetDef.maxLines;
    } else {
      maxLines = 0;
    }
  }
  if (isMini && maxLines === 1 && !height) {
    height = '2.5rem';
  }

  let merged = RTE.utils.mergeOptions(options as Record<string, unknown>, {
    height: height || options.height || '400px',
    initialContent: textarea.value || '',
    toolbarPreset: presetName,
    maxLines: maxLines,
    onChange: (html: string) => {
      textarea.value = html;
      if (typeof options!.onChange === 'function') options!.onChange(html);
    },
  }) as EditorOptions;

  merged = RTE.utils.mergeOptions(merged as Record<string, unknown>, options as Record<string, unknown>) as EditorOptions;
  merged.toolbarPreset = presetName;
  merged.initialContent = textarea.value || merged.initialContent || '';
  if (height) merged.height = height;
  if (merged.maxLines == null) merged.maxLines = maxLines;
  if (isMini && (merged.maxLines == null || merged.maxLines === 0)) {
    merged.maxLines = 1;
  }

  const facade = RTE.create!(host, merged);
  textarea._rteFacade = facade;
  facade._textarea = textarea;

  const sync = () => {
    // While editing source, keep the raw textarea in sync so incomplete tags are not
    // rewritten on every keystroke. Submit / getHTML() still sanitize.
    if (facade._core?.currentMode === 'source' && facade._core.sourceEditor) {
      textarea.value = facade._core.sourceEditor.value;
      return;
    }
    textarea.value = facade.getHTML();
  };
  const form = textarea.closest('form') as HTMLFormElement | null;
  if (form && !form._rteSubmitBound) {
    form.addEventListener('submit', () => {
      form.querySelectorAll('textarea[data-rte-bound="1"]').forEach((ta) => {
        const area = ta as HTMLTextAreaElement;
        if (area._rteFacade) area.value = area._rteFacade.getHTML();
      });
    });
    form._rteSubmitBound = true;
  }

  if (facade._core?.richTextEditor) {
    facade._core.richTextEditor.addEventListener('input', sync);
    facade._core.richTextEditor.addEventListener('blur', sync);
  }
  if (facade._core?.sourceEditor) {
    facade._core.sourceEditor.addEventListener('input', sync);
    facade._core.sourceEditor.addEventListener('blur', () => {
      textarea.value = facade.getHTML();
    });
  }

  return facade;
};

RTE.getFromTextarea = function (textarea: HTMLTextAreaElement | null | undefined): string {
  if (!textarea) return '';
  if (textarea._rteFacade) return textarea._rteFacade.getHTML();
  return textarea.value || '';
};

RTE.setOnTextarea = function (textarea: HTMLTextAreaElement | null | undefined, html: string): void {
  if (!textarea) return;
  if (textarea._rteFacade) {
    textarea._rteFacade.setHTML(html || '');
    textarea.value = html || '';
    return;
  }
  textarea.value = html || '';
};

// Ensure IIFE global is the namespace (esbuild wraps as RichTextEditorBundle)
export {};
