// @ts-nocheck — migrated shell; public fields typed above; mixin call sites rely on runtime assign
import type { EditorOptions } from './types';
import { ensureNamespace } from './namespace';
import { collapseEditorHtml } from './html-format';
import { sanitizeEditorHtml } from './sanitize-editor-html';
import {
  createSourceCodeEditor,
  type SourceEditorSurface,
} from './source-code-editor';
import { DEFAULT_TOOLBAR_PRESET, mergeSymbols, readSiteColorDefaults } from './config';
import { RTE_Z_MODAL } from './z-index';
import { bindEditorBlockRemove, decorateEditorBlocks } from './template-blocks';

/** Site-derived defaults, overridden by any non-empty value in RTE.COLORS.defaults. */
function mergeColorDefaults(site, configured) {
    const out = { ...site };
    Object.keys(configured || {}).forEach((key) => {
        if (configured[key]) out[key] = configured[key];
    });
    return out;
}

/**
 * RichTextEditor core shell — constructor, init, layout, rich/source surfaces, content API.
 * Feature methods are mixed onto the prototype by history/paste/... modules.
 */
export class RichTextEditorCore {
    containerId: string;
    container: HTMLElement | null;
    options: EditorOptions;
    currentMode: 'rich' | 'source';
    richTextEditor: HTMLDivElement | null;
    sourceEditor: SourceEditorSurface | null;
    toolbar: HTMLElement | null;
    wordCountElement: HTMLElement | null;
    content: string;
    activeStates: Record<string, boolean>;
    currentPageKey: string | null;
    imagePanel: HTMLElement | null;
    savedSelectionRange: Range | { start: number; end: number } | null;
    richHistory: string[];
    richHistoryCursor: number;
    richHistoryMax: number;
    _richHistoryRecordTimer: ReturnType<typeof setTimeout> | null;
    _richHistoryApplying: boolean;
    editorContainer!: HTMLElement;

    constructor(containerId: string, options: EditorOptions = {}) {
        this.containerId = containerId;
        this.container = document.getElementById(containerId);
        this.options = this.getDefaultOptions(options);
        this.currentMode = 'rich';
        this.richTextEditor = null;
        this.sourceEditor = null;
        this.toolbar = null;
        this.wordCountElement = null;
        this.content = '';
        this.activeStates = {};
        this.currentPageKey = null;
        this.imagePanel = null;
        this.savedSelectionRange = null;
        this.richHistory = [];
        this.richHistoryCursor = 0;
        this.richHistoryMax = 120;
        this._richHistoryRecordTimer = null;
        this._richHistoryApplying = false;
        this.init();
    }

    getDefaultOptions(customOptions: EditorOptions = {}): EditorOptions {
        const RTE = window.RichTextEditor || {};
        const requestedPreset = customOptions && customOptions.toolbarPreset;
        const presetName = RTE.hasToolbarPreset && RTE.hasToolbarPreset(requestedPreset)
            ? requestedPreset
            : DEFAULT_TOOLBAR_PRESET;
        const presetDef = (RTE.getToolbarPresetDef && RTE.getToolbarPresetDef(presetName)) || {};
        const presetToolbar = RTE.resolveToolbar ? RTE.resolveToolbar(presetName) : null;
        const defaultOptions = {
            height: '400px',
            placeholder: 'Enter your content here...',
            enableRichText: true,
            enableSourceMode: true,
            showImagePanel: false,
            languageCode: 'en',
            iconsBaseUrl: '/admin/editor/icons/',
            templatesUrl: '/admin/editor/templates.json',
            fonts: (RTE.FONTS || []).map((f) => ({ ...f })),
            fontSizes: [
                { text: '(inherited)', value: '' },
                { text: '8px', value: '8px' },
                { text: '10px', value: '10px' },
                { text: '12px', value: '12px' },
                { text: '14px', value: '14px' },
                { text: '16px', value: '16px' },
                { text: '18px', value: '18px' },
                { text: '20px', value: '20px' },
                { text: '24px', value: '24px' },
                { text: '28px', value: '28px' },
                { text: '32px', value: '32px' },
                { text: '36px', value: '36px' },
                { text: '40px', value: '40px' },
                { text: '44px', value: '44px' },
                { text: '48px', value: '48px' },
                { text: '52px', value: '52px' }
            ],
            blockFormats: [
                { text: 'Paragraph', value: 'p' },
                { text: 'Heading 1', value: 'h1' },
                { text: 'Heading 2', value: 'h2' },
                { text: 'Heading 3', value: 'h3' },
                { text: 'Heading 4', value: 'h4' },
                { text: 'Heading 5', value: 'h5' },
                { text: 'Heading 6', value: 'h6' },
                { text: 'Preformatted', value: 'pre' }
            ],
            colors: (RTE.COLORS && RTE.COLORS.palette && RTE.COLORS.palette.length)
                ? RTE.COLORS.palette.slice()
                : (RTE.readSiteColors ? RTE.readSiteColors() : []),
            colorDefaults: mergeColorDefaults(readSiteColorDefaults(), (RTE.COLORS && RTE.COLORS.defaults) || {}),
            symbols: (RTE.DEFAULT_SYMBOLS || []).slice(),
            symbolColumns: 10,
            fileManager: {
                pageListUrl: '',
                libraryListUrl: '',
                uploadUrl: '',
                csrfHeader: '',
                csrfField: '',
                uploadFieldName: 'file',
                pageKeyField: '',
                getCsrfToken: function () { return ''; },
                mapList: function (response) {
                    if (!response) return [];
                    return response.files || response.images || [];
                },
                mapUpload: function (response) {
                    return {
                        name: response.fileName || response.name,
                        url: response.fileUrl || response.url
                    };
                }
            },
            toolbar: presetToolbar || [],
            tableToolbar: (RTE.TABLE_TOOLBAR || []).slice(),
            insertMenu: (presetDef.insertMenu || []).slice(),
            onChange: null,
            // 0 = unlimited; presets may set their own default (mini = 1)
            maxLines: presetDef.maxLines || 0
        };
        const merged = (RTE.utils && RTE.utils.mergeOptions)
            ? RTE.utils.mergeOptions(defaultOptions, customOptions || {})
            : Object.assign({}, defaultOptions, customOptions || {});
        if (customOptions && customOptions.fileManager) {
            merged.fileManager = Object.assign({}, defaultOptions.fileManager, customOptions.fileManager);
        }
        merged.colorDefaults = Object.assign({}, defaultOptions.colorDefaults, (customOptions && customOptions.colorDefaults) || {});
        if (customOptions && Array.isArray(customOptions.extraSymbols) && customOptions.extraSymbols.length) {
            merged.symbols = mergeSymbols(merged.symbols || [], customOptions.extraSymbols);
        }
        merged.toolbarPreset = presetName;
        if (customOptions && customOptions.toolbar) {
            merged.toolbar = customOptions.toolbar;
        } else if (presetToolbar) {
            merged.toolbar = presetToolbar.slice();
        }
        if (customOptions && customOptions.maxLines != null) {
            merged.maxLines = customOptions.maxLines;
        } else if (presetDef.maxLines && (merged.maxLines == null || merged.maxLines === 0)) {
            merged.maxLines = presetDef.maxLines;
        }
        return merged;
    }

    getToolbarPresetDef() {
        const RTE = window.RichTextEditor || {};
        return (RTE.getToolbarPresetDef && RTE.getToolbarPresetDef(this.options.toolbarPreset)) || {};
    }

    /** Compact single-line preset (mini host classes, mini templates). */
    isMiniPreset() {
        return !!this.getToolbarPresetDef().mini;
    }

    /** Toolbar floats above the editor on focus instead of being docked. */
    isFloatingToolbar() {
        return !!this.getToolbarPresetDef().floating;
    }

    init() {
        if (!this.container) {
            console.error(`Container with ID '${this.containerId}' not found`);
            return;
        }

        try {
            // Get current page key
            this.currentPageKey = this.getPageKey();

            // Create editor layout
            this.createEditorLayout();

            // Create toolbar
            this.createToolbar();

            // Create rich text editor
            this.createRichTextEditor();

            if (typeof this.initMiniFloatingToolbar === 'function') {
                this.initMiniFloatingToolbar();
            }

            // Create source editor
            this.createSourceEditor();

            // Add word count
            this.addWordCount();

            // Create image panel if enabled
            if (this.options.showImagePanel) {
                this.createImagePanel();
                this.loadCurrentPageImages();
            }

            // Initialize with existing content
            this.initializeContent();

            // Set initial mode
            this.setMode('rich');

            // Initialize active state tracking
            this.initializeActiveStateTracking();

            console.log('Rich text editor initialized successfully');
        } catch (error) {
            console.error('Error initializing custom editor:', error);
        }
    }

    createEditorLayout() {
        // Preserve host classes (e.g. rte-mini) while ensuring container marker is present
        this.container.classList.add('rte-container');
        this.container.style.cssText = `
            display: flex;
            gap: 20px;
            height: 100%;
            width: 100%;
        `;
        this.applyColorDefaultVars();

        // Create main container for editor and image panel
        this.editorContainer = document.createElement('div');
        this.editorContainer.className = 'rte-main';
        this.editorContainer.style.cssText = `
            display: flex;
            flex-direction: column;
            flex: 1;
            height: 100%;
        `;

        // Move existing content to editor container
        while (this.container.firstChild) {
            this.editorContainer.appendChild(this.container.firstChild);
        }

        // Add editor container back to main container
        this.container.appendChild(this.editorContainer);
    }

    /** Expose configured table header defaults to editor.css. */
    applyColorDefaultVars() {
        const defaults = this.options.colorDefaults || {};
        const setVar = (name, value) => {
            if (value) this.container.style.setProperty(name, value);
            else this.container.style.removeProperty(name);
        };
        setVar('--rte-table-header-bg', defaults.headerBackground);
        setVar('--rte-table-header-color', defaults.headerText);
    }

    createRichTextEditor() {
        this.richTextEditor = document.createElement('div');
        this.richTextEditor.className = 'rte-rich';
        this.richTextEditor.contentEditable = true;
        const maxLines = parseInt(String(this.options.maxLines ?? 0), 10) || 0;
        if (this.isMiniPreset()) {
            this.container.classList.add('rte-mini');
        }
        if (maxLines > 0) {
            this.richTextEditor.setAttribute('data-max-lines', String(maxLines));
            this.container.classList.add('rte-max-lines');
            if (maxLines === 1) {
                this.container.classList.add('rte-single-line');
            }
        }
        const heightCss = maxLines === 1
            ? 'min-height: 2rem; max-height: 2.5rem; height: 2.5rem; overflow: hidden;'
            : `min-height: ${this.options.height}; overflow-y: auto;`;
        this.richTextEditor.style.cssText = `
            border: 1px solid #ccc;
            padding: ${maxLines === 1 ? '6px 12px' : '12px'};
            ${heightCss}
            line-height: ${maxLines === 1 ? '1.4' : '1.6'};
            outline: none;
            background: white;
            white-space: ${maxLines === 1 ? 'nowrap' : 'normal'};
            box-sizing: border-box;
        `;
        this.richTextEditor.setAttribute('data-placeholder', this.options.placeholder);

        // Add placeholder functionality
        this.richTextEditor.addEventListener('focus', () => {
            // Check if current content is just the placeholder
            const isPlaceholder = this.richTextEditor.innerHTML.includes('color: #999') &&
                this.richTextEditor.innerHTML.includes('font-style: italic') &&
                this.richTextEditor.textContent.trim() === '';

            if (isPlaceholder) {
                this.richTextEditor.innerHTML = '';
                this.flushRichHistoryImmediate();
            }
        });

        this.richTextEditor.addEventListener('blur', () => {
            // Save selection when leaving editor so toolbar click can restore it (multi-instance)
            const sel = window.getSelection();
            if (sel.rangeCount) {
                const range = sel.getRangeAt(0);
                const ancestor = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
                    ? range.commonAncestorContainer
                    : range.commonAncestorContainer.parentElement;
                if (ancestor && this.richTextEditor.contains(ancestor)) {
                    try {
                        this.savedSelectionRange = range.cloneRange();
                    } catch (err) {
                        this.savedSelectionRange = null;
                    }
                } else {
                    this.savedSelectionRange = null;
                }
            } else {
                this.savedSelectionRange = null;
            }
            // Check if editor has actual content (text or elements like iframes, images, etc.)
            const hasContent = this.richTextEditor.textContent.trim() !== '' ||
                this.richTextEditor.querySelector('iframe, img, video, embed, object') !== null ||
                (this.richTextEditor.innerHTML.trim() !== '' &&
                    !this.richTextEditor.innerHTML.includes('color: #999') && // Not placeholder
                    !this.richTextEditor.innerHTML.includes('font-style: italic')); // Not placeholder

            if (!hasContent) {
                this.richTextEditor.innerHTML = `<div style="color: #999; font-style: italic;">${this.options.placeholder}</div>`;
            }
            this.flushRichHistoryImmediate();
        });

        // Add content change listener
        this.richTextEditor.addEventListener('input', () => {
            this.updateWordCount();
            this.content = this.richTextEditor.innerHTML;
            this.updateActiveStates();
            this.scheduleRichHistoryRecord();
        });

        // Add selection change listener for active state tracking
        this.richTextEditor.addEventListener('keyup', () => {
            this.updateActiveStates();
        });

        this.richTextEditor.addEventListener('mouseup', () => {
            this.updateActiveStates();
        });

        // Capture Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z — per-instance history (not document.execCommand undo)
        // Also enforce maxLines (block Enter when at limit).
        this.richTextEditor.addEventListener('keydown', (e) => {
            const maxLines = parseInt(this.options.maxLines, 10) || 0;
            if (maxLines > 0 && (e.key === 'Enter' || e.keyCode === 13)) {
                if (maxLines === 1 || this.countVisualLines() >= maxLines) {
                    e.preventDefault();
                    e.stopPropagation();
                    return;
                }
            }

            const key = (e.key || '').toLowerCase();
            if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey && (key === 'f' || key === 'h')) {
                const action = key === 'f' ? 'find' : 'findReplace';
                if (typeof this.showFindPanel === 'function' && this.hasToolbarAction(action)) {
                    e.preventDefault();
                    e.stopPropagation();
                    this.showFindPanel(action === 'findReplace');
                    return;
                }
            }

            const isUndo = (e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey;
            const isRedo = ((e.ctrlKey || e.metaKey) && e.key === 'y') ||
                ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z');
            if ((isUndo || isRedo) && this.richTextEditor.contains(e.target)) {
                e.preventDefault();
                e.stopPropagation();
                this.flushRichHistoryImmediate();
                if (isUndo) {
                    this.performRichUndo();
                } else {
                    this.performRichRedo();
                }
            }
        });

        // Add double-click listener for image editing
        this.richTextEditor.addEventListener('dblclick', (e) => {
            if (e.target.tagName === 'IMG') {
                e.preventDefault();
                e.stopPropagation();
                this.showImageEditModal(e.target);
            }
        });

        // Paste: images upload via fileManager; HTML/text sanitized
        this.richTextEditor.addEventListener('paste', (e) => {
            this.handleRichPaste(e);
        });

        const self = this;
        bindEditorBlockRemove(this.richTextEditor, () => {
            self.content = self.richTextEditor.innerHTML;
            self.notifyChange && self.notifyChange();
            self.updateWordCount();
            self.scheduleRichHistoryRecord && self.scheduleRichHistoryRecord();
        });

        this.editorContainer.appendChild(this.richTextEditor);
    }

    /**
     * Attach editor-only remove chrome to template roots and hidden separators.
     */
    refreshEditorBlocks() {
        decorateEditorBlocks(this.richTextEditor);
    }

    createSourceEditor() {
        this.sourceEditor = createSourceCodeEditor({
            height: this.options.height,
            placeholder: 'Enter HTML content here...',
            onPaste: (e) => {
                e.preventDefault();
                const clipboardData = e.clipboardData || window.clipboardData;
                const htmlData = clipboardData.getData('text/html');
                const plainData = clipboardData.getData('text/plain');
                let chunk = htmlData || plainData;
                if (!chunk) {
                    return false;
                }
                chunk = this.stripFigmaBufferFromHtmlString(chunk);
                if (htmlData) {
                    chunk = this.sanitizePastedHtml(chunk);
                }
                const start = this.sourceEditor.selectionStart;
                const end = this.sourceEditor.selectionEnd;
                const before = this.sourceEditor.value.slice(0, start);
                const after = this.sourceEditor.value.slice(end);
                this.sourceEditor.value = before + chunk + after;
                const newPos = start + chunk.length;
                this.sourceEditor.setSelectionRange(newPos, newPos);
                this.sourceEditor.dispatchEvent(new Event('input', { bubbles: true }));
                return false;
            },
        });

        this.sourceEditor.addEventListener('input', () => {
            this.updateWordCount();
            this.content = this.sourceEditor.value;
        });

        this.editorContainer.appendChild(this.sourceEditor);
    }

    addWordCount() {
        this.wordCountElement = document.createElement('div');
        this.wordCountElement.className = 'rte-word-count';
        this.wordCountElement.style.cssText = `
            padding: 8px 12px;
            background: #f8f9fa;
            border: 1px solid #ccc;
            border-top: none;
            font-size: 12px;
            color: #666;
            text-align: right;
        `;
        this.wordCountElement.textContent = '0 words, 0 characters';

        this.editorContainer.appendChild(this.wordCountElement);
    }

    updateWordCount() {
        const text = this.getText();
        const wordCount = text ? text.split(/\s+/).length : 0;
        const charCount = text.length;
        this.wordCountElement.textContent = `${wordCount} words, ${charCount} characters`;
    }

    getText() {
        if (this.currentMode === 'source') {
            return this.sourceEditor.value;
        } else {
            return this.richTextEditor.textContent || this.richTextEditor.innerText;
        }
    }

    createModal(title, fields) {
        // Remove existing modal if any
        const existingModal = document.querySelector('.rte-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement('div');
        modal.className = 'rte-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: ${RTE_Z_MODAL};
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 24px;
            border-radius: 8px;
            min-width: 400px;
            max-width: 500px;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        `;

        // Title
        const modalTitle = document.createElement('h3');
        modalTitle.textContent = title;
        modalTitle.style.cssText = `
            margin: 0 0 20px 0;
            color: #333;
            font-size: 18px;
        `;
        modalContent.appendChild(modalTitle);

        // Fields
        fields.forEach(field => {
            const fieldContainer = document.createElement('div');
            fieldContainer.style.cssText = 'margin-bottom: 16px;';

            const label = document.createElement('label');
            label.textContent = field.label;
            label.style.cssText = `
                display: block;
                margin-bottom: 6px;
                font-weight: 500;
                color: #555;
            `;
            fieldContainer.appendChild(label);

            const input = document.createElement('input');
            input.type = field.type;
            input.id = field.id;
            input.placeholder = field.placeholder;
            input.style.cssText = `
                width: 100%;
                padding: 8px 12px;
                border: 1px solid #ddd;
                border-radius: 4px;
                font-size: 14px;
                box-sizing: border-box;
            `;
            fieldContainer.appendChild(input);

            modalContent.appendChild(fieldContainer);
        });

        // Buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.cssText = `
            display: flex;
            gap: 12px;
            justify-content: flex-end;
            margin-top: 24px;
        `;

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'modal-cancel';
        cancelBtn.style.cssText = `
            padding: 8px 16px;
            border: 1px solid #ddd;
            background: white;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;
        cancelBtn.addEventListener('click', () => this.closeModal(modal));

        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Insert';
        confirmBtn.className = 'modal-confirm';
        confirmBtn.style.cssText = `
            padding: 8px 16px;
            border: 1px solid var(--rte-accent);
            background: var(--rte-accent);
            color: white;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
        `;

        buttonContainer.appendChild(cancelBtn);
        buttonContainer.appendChild(confirmBtn);
        modalContent.appendChild(buttonContainer);

        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Close on escape key
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                this.closeModal(modal);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        document.addEventListener('keydown', handleEscape);

        return modal;
    }

    closeModal(modal) {
        if (modal && modal.parentNode) {
            modal.parentNode.removeChild(modal);
        }
    }

    initializeContent() {
        // Check if initial content is provided in options
        if (this.options.initialContent) {
            const safe = sanitizeEditorHtml(this.options.initialContent);
            this.content = safe;
            this.richTextEditor.innerHTML = safe;
            this.sourceEditor.value = safe;
            this.refreshEditorBlocks();
            this.updateWordCount();
            this.resetRichHistory();
            return;
        }

        // Check if there's existing content in the textarea (fallback)
        const textarea = document.querySelector(`textarea[name="content"]`);
        if (textarea && textarea.value) {
            const safe = sanitizeEditorHtml(textarea.value);
            this.content = safe;
            this.richTextEditor.innerHTML = safe;
            this.sourceEditor.value = safe;
            this.refreshEditorBlocks();
            this.updateWordCount();
        }
        this.resetRichHistory();
    }

    getHTML() {
        if (this.currentMode === 'source') {
            // Collapse display indent so saved / flushed HTML stays compact
            return collapseEditorHtml(sanitizeEditorHtml(this.sourceEditor.value));
        }
        return sanitizeEditorHtml(this.richTextEditor.innerHTML);
    }

    setHTML(html) {
        const safe = sanitizeEditorHtml(html || '');
        this.content = safe;
        this.richTextEditor.innerHTML = safe;
        this.sourceEditor.value = safe;
        this.refreshEditorBlocks();
        this.updateWordCount();
        this.resetRichHistory();
    }

    getContent() {
        return this.getHTML();
    }

    setContent(content) {
        this.setHTML(content);
    }

    focus() {
        if (this.currentMode === 'rich') {
            this.richTextEditor.focus();
        } else {
            this.sourceEditor.focus();
        }
    }

    destroy() {
        clearTimeout(this._richHistoryRecordTimer);
        this._richHistoryRecordTimer = null;
        if (typeof this.teardownMiniFloatingToolbar === 'function') {
            this.teardownMiniFloatingToolbar();
        }
        if (typeof this.teardownTableToolbar === 'function') {
            this.teardownTableToolbar();
        }
        if (typeof this.teardownFindPanel === 'function') {
            this.teardownFindPanel();
        }
        if (typeof this.exitFullscreen === 'function') {
            this.exitFullscreen();
        } else {
            document.body.classList.remove('rte-fs-open');
        }
        if (this.sourceEditor && typeof this.sourceEditor._destroySourceEditor === 'function') {
            this.sourceEditor._destroySourceEditor();
        }
        if (this.toolbar && this.toolbar.parentNode) {
            this.toolbar.parentNode.removeChild(this.toolbar);
        }
        if (this.wordCountElement && this.wordCountElement.parentNode) {
            this.wordCountElement.parentNode.removeChild(this.wordCountElement);
        }
        if (this.imagePanel && this.imagePanel.parentNode) {
            this.imagePanel.parentNode.removeChild(this.imagePanel);
        }
    }
}

ensureNamespace().Core = RichTextEditorCore;
(window as Window).initRichTextEditor = function (containerId: string, options?: EditorOptions) {
  return new RichTextEditorCore(containerId, options || {});
};
