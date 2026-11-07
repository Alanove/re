import type {
  EditorColorConfig,
  EditorFacade,
  FontOption,
  EditorOptions,
  FileManagerConfig,
  RegisterSymbolsOptions,
  SymbolOption,
  ToolbarPresetDefinition,
} from './types';
import type { RichTextEditorCore } from './core';

export interface RichTextEditorUtils {
  resolveElement(elOrId: HTMLElement | string | null | undefined): HTMLElement | null;
  escapeAttr(str: unknown): string;
  formatFileSize(bytes: number): string;
  showModal(modalEl: HTMLElement | null | undefined): void;
  hideModal(modalEl: HTMLElement | null | undefined): void;
  removeOverlayModals(): void;
  mergeOptions<T extends Record<string, unknown>>(defaults: T, custom?: Partial<T> | null): T;
}

export interface RichTextEditorNamespace {
  version: string;
  _instances: EditorFacade[];
  utils: RichTextEditorUtils;
  Dialogs: Record<string, unknown>;
  TOOLBAR_PRESETS?: Record<string, string[]>;
  TOOLBAR_GROUPS?: Record<string, string[]>;
  TOOLBAR_PRESET_DEFS?: Record<string, ToolbarPresetDefinition>;
  TABLE_TOOLBAR?: string[];
  resolveToolbar?: (name?: string | null) => string[];
  getToolbarPresetDef?: (name?: string | null) => ToolbarPresetDefinition | null;
  hasToolbarPreset?: (name?: string | null) => boolean;
  registerToolbarPreset?: (name: string, def: ToolbarPresetDefinition) => void;
  registerToolbarGroup?: (name: string, items: string[]) => void;
  DEFAULT_SYMBOLS?: SymbolOption[];
  COLORS?: EditorColorConfig;
  /** CSS custom properties read from :root as palette swatches (when set and non-empty). */
  SITE_COLOR_VARS?: string[];
  readSiteColors?: () => string[];
  FONTS?: FontOption[];
  registerSymbols?: (items: SymbolOption[], options?: RegisterSymbolsOptions) => void;
  Core?: typeof RichTextEditorCore;
  create?: (containerElOrId: HTMLElement | string, options?: EditorOptions) => EditorFacade;
  destroy?: (instance: EditorFacade | null | undefined) => void;
  mountTextarea?: (textarea: HTMLTextAreaElement, options?: EditorOptions) => EditorFacade;
  getFromTextarea?: (textarea: HTMLTextAreaElement | null | undefined) => string;
  setOnTextarea?: (textarea: HTMLTextAreaElement | null | undefined, html: string) => void;
}

function createUtils(): RichTextEditorUtils {
  return {
    resolveElement(elOrId) {
      if (!elOrId) return null;
      if (typeof elOrId === 'string') {
        return document.getElementById(elOrId) || document.querySelector(elOrId);
      }
      return elOrId.nodeType === 1 ? elOrId : null;
    },

    escapeAttr(str) {
      if (str == null) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    },

    formatFileSize(bytes) {
      if (!bytes || bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    showModal(modalEl) {
      if (!modalEl) return;
      const bootstrap = window.bootstrap;
      if (bootstrap?.Modal) {
        const inst = bootstrap.Modal.getOrCreateInstance
          ? bootstrap.Modal.getOrCreateInstance(modalEl)
          : new bootstrap.Modal(modalEl);
        inst.show();
        return;
      }
      if (window.$?.fn?.modal) {
        window.$(modalEl).modal('show');
        return;
      }
      modalEl.style.display = 'block';
      modalEl.classList.add('show');
      modalEl.setAttribute('aria-modal', 'true');
      document.body.classList.add('modal-open');
    },

    hideModal(modalEl) {
      if (!modalEl) return;
      const bootstrap = window.bootstrap;
      if (bootstrap?.Modal) {
        const inst = bootstrap.Modal.getInstance ? bootstrap.Modal.getInstance(modalEl) : null;
        if (inst) {
          inst.hide();
          return;
        }
      }
      if (window.$?.fn?.modal) {
        window.$(modalEl).modal('hide');
        return;
      }
      modalEl.style.display = 'none';
      modalEl.classList.remove('show');
      document.body.classList.remove('modal-open');
    },

    removeOverlayModals() {
      document.querySelectorAll('.rte-modal').forEach((el) => el.remove());
    },

    mergeOptions(defaults, custom) {
      const out = { ...defaults } as Record<string, unknown>;
      if (!custom) return out as typeof defaults;
      for (const key of Object.keys(custom)) {
        if (
          key === 'fileManager' &&
          out.fileManager &&
          typeof custom.fileManager === 'object' &&
          custom.fileManager
        ) {
          out.fileManager = createUtils().mergeOptions(
            out.fileManager as Record<string, unknown>,
            custom.fileManager as Record<string, unknown>
          );
        } else {
          out[key] = (custom as Record<string, unknown>)[key];
        }
      }
      return out as typeof defaults;
    },
  };
}

export function ensureNamespace(): RichTextEditorNamespace {
  const existing = (window as Window & { RichTextEditor?: RichTextEditorNamespace }).RichTextEditor;
  const RTE: RichTextEditorNamespace = existing || {
    version: '1.0.0',
    _instances: [],
    utils: createUtils(),
    Dialogs: {},
  };
  if (!RTE.utils) RTE.utils = createUtils();
  if (!RTE._instances) RTE._instances = [];
  if (!RTE.Dialogs) RTE.Dialogs = {};
  if (!RTE.version) RTE.version = '1.0.0';
  window.RichTextEditor = RTE;
  window.RTE = RTE;
  return RTE;
}

ensureNamespace();

export type { FileManagerConfig, EditorOptions };
