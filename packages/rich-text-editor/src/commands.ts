// @ts-nocheck
/**
 * RichTextEditor mixin — commands.ts
 */
import { clearFormattingInSelection } from './clear-formatting';
import { RichTextEditorCore } from './core';
import { collapseEditorHtml, formatEditorHtml } from './html-format';
import { sanitizeEditorHtml } from './sanitize-editor-html';
import { refreshSourceEditor } from './source-code-editor';
import { decorateEditorBlocks, RTE_HIDDEN_SEP_CLASS } from './template-blocks';
import { RTE_Z_FULLSCREEN } from './z-index';

function rangeIsInside(range, el) {
    if (!range || !el) return false;
    try {
        const node = range.commonAncestorContainer;
        if (!node) return false;
        if (el === node || el.contains(node)) return true;
        const parent = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
        return !!(parent && el.contains(parent));
    } catch (e) {
        return false;
    }
}

Object.assign(
  RichTextEditorCore.prototype,
  {

        restoreSavedSelection() {
            if (!this.richTextEditor) return;
            this.richTextEditor.focus();
            const range = this.savedSelectionRange;
            if (range && typeof range.cloneRange === 'function' && rangeIsInside(range, this.richTextEditor)) {
                const sel = window.getSelection();
                sel.removeAllRanges();
                try { sel.addRange(range); } catch (e) { /* ignore */ }
                return;
            }
            this.ensureCaretInThisEditor();
        },

        ensureCaretInThisEditor() {
            if (!this.richTextEditor) return;
            const sel = window.getSelection();
            if (sel && sel.rangeCount) {
                const range = sel.getRangeAt(0);
                if (rangeIsInside(range, this.richTextEditor)) return;
            }
            const r = document.createRange();
            r.selectNodeContents(this.richTextEditor);
            r.collapse(false);
            if (sel) {
                sel.removeAllRanges();
                try { sel.addRange(r); } catch (e) { /* ignore */ }
            }
            this.richTextEditor.focus();
        },

        applyInlineStyle(prop, value) {
            const sel = window.getSelection();
            if (!sel.rangeCount) return;
            const range = sel.getRangeAt(0);
            if (range.collapsed) {
                const span = document.createElement('span');
                span.style[prop] = value;
                span.appendChild(document.createTextNode('\u200B'));
                range.insertNode(span);
                range.setStart(span.firstChild, 1);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                return;
            }
            const span = document.createElement('span');
            span.style[prop] = value;
            try {
                range.surroundContents(span);
            } catch (e) {
                const frag = range.extractContents();
                span.appendChild(frag);
                range.insertNode(span);
            }
        },

        notifyChange() {
            this.updateWordCount();
            this.scheduleRichHistoryRecord();
            if (typeof this.options.onChange === 'function') {
                this.options.onChange(this.getHTML());
            }
        },

        clearFormatting() {
            const editor = this.richTextEditor;
            if (!editor) return;
            const placeholder = this.options && this.options.placeholder;
            if (
                placeholder &&
                editor.textContent.trim() === String(placeholder).trim() &&
                editor.innerHTML.includes('color: #999')
            ) {
                return;
            }
            clearFormattingInSelection(editor);
            this.notifyChange();
        },

        /**
         * Toggle text-transform: uppercase on the selection (Word-style All Caps).
         * Collapsed caret expands to the current word.
         */
        toggleUppercase() {
            const editor = this.richTextEditor;
            if (!editor) return;
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount) return;

            let range = sel.getRangeAt(0);
            if (!editor.contains(range.commonAncestorContainer)) return;

            if (range.collapsed) {
                const node = range.startContainer;
                if (node.nodeType === Node.TEXT_NODE) {
                    const text = node.textContent || '';
                    let start = range.startOffset;
                    let end = range.startOffset;
                    while (start > 0 && /\S/.test(text.charAt(start - 1))) start--;
                    while (end < text.length && /\S/.test(text.charAt(end))) end++;
                    if (start < end) {
                        range = document.createRange();
                        range.setStart(node, start);
                        range.setEnd(node, end);
                        sel.removeAllRanges();
                        sel.addRange(range);
                    }
                }
            }

            if (range.collapsed) {
                this.applyInlineStyle('textTransform', 'uppercase');
                this.notifyChange();
                return;
            }

            // If selection is already fully uppercase-styled, remove it; else apply
            let alreadyUpper = false;
            try {
                const probe = range.cloneContents();
                const walker = document.createTreeWalker(probe, NodeFilter.SHOW_ELEMENT);
                let el = walker.nextNode();
                let found = false;
                let allUpper = true;
                while (el) {
                    found = true;
                    const tf = (el.style && el.style.textTransform) || '';
                    if (tf.toLowerCase() !== 'uppercase') {
                        allUpper = false;
                        break;
                    }
                    el = walker.nextNode();
                }
                // Also check if common ancestor has uppercase
                let anc = range.commonAncestorContainer;
                if (anc.nodeType === Node.TEXT_NODE) anc = anc.parentElement;
                if (anc && anc.closest && anc.closest('[style*="text-transform: uppercase"], [style*="text-transform:uppercase"]')) {
                    alreadyUpper = true;
                } else if (found && allUpper) {
                    alreadyUpper = true;
                }
            } catch (e) {
                /* ignore */
            }

            if (alreadyUpper) {
                // Unwrap / clear text-transform on spans in selection
                try {
                    const contents = range.extractContents();
                    const clearTf = (node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const el = node;
                            if (el.style && el.style.textTransform) {
                                el.style.textTransform = '';
                                if (!el.getAttribute('style') || !el.getAttribute('style').trim()) {
                                    el.removeAttribute('style');
                                }
                            }
                            Array.from(el.childNodes).forEach(clearTf);
                        }
                    };
                    Array.from(contents.childNodes).forEach(clearTf);
                    range.insertNode(contents);
                } catch (e) {
                    this.applyInlineStyle('textTransform', 'none');
                }
            } else {
                this.applyInlineStyle('textTransform', 'uppercase');
            }
            this.notifyChange();
        },

        /**
         * Insert an editor-visible / publish-hidden separator after the current top-level block,
         * then a clean paragraph for continued typing.
         */
        insertHiddenSeparator() {
            const editor = this.richTextEditor;
            if (!editor) return;

            const sel = window.getSelection();
            let anchor = null;
            if (sel && sel.rangeCount) {
                let node = sel.getRangeAt(0).commonAncestorContainer;
                if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
                while (node && node !== editor && node.parentElement !== editor) {
                    node = node.parentElement;
                }
                if (node && node.parentElement === editor) {
                    anchor = node;
                }
            }

            const wrap = document.createElement('div');
            wrap.className = 'rte-hidden-sep-wrap rte-template-block';
            wrap.setAttribute('contenteditable', 'false');
            const hr = document.createElement('hr');
            hr.className = RTE_HIDDEN_SEP_CLASS;
            wrap.appendChild(hr);

            const para = document.createElement('p');
            para.appendChild(document.createElement('br'));

            if (anchor) {
                if (anchor.nextSibling) {
                    editor.insertBefore(wrap, anchor.nextSibling);
                    editor.insertBefore(para, wrap.nextSibling);
                } else {
                    editor.appendChild(wrap);
                    editor.appendChild(para);
                }
            } else {
                editor.appendChild(wrap);
                editor.appendChild(para);
            }

            decorateEditorBlocks(editor);

            try {
                const r = document.createRange();
                r.selectNodeContents(para);
                r.collapse(true);
                sel.removeAllRanges();
                sel.addRange(r);
            } catch (e) {
                /* ignore */
            }

            this.content = editor.innerHTML;
            this.notifyChange();
        },

        handleToolbarAction(action) {
            if (action === 'source') {
                this.toggleSourceMode();
                return;
            }
            if (action === 'expand') {
                this.toggleFullscreen();
                return;
            }
            if (action === 'preview') {
                this.showPreviewModal();
                return;
            }
    
            if (this.currentMode === 'source') {
                // In source mode, only allow switching to rich mode / expand (handled above)
                return;
            }
    
            // Focus this instance and restore selection so format commands apply to this editor only
            this.restoreSavedSelection();
            this.ensureCaretInThisEditor();
            this.savedSelectionRange = null;

            if (action === 'find' || action === 'findReplace') {
                this.showFindPanel(action === 'findReplace');
                return;
            }
    
            switch (action) {
                case 'bold':
                    document.execCommand('bold', false, null);
                    break;
                case 'italic':
                    document.execCommand('italic', false, null);
                    break;
                case 'underline':
                    document.execCommand('underline', false, null);
                    break;
                case 'strike':
                    document.execCommand('strikeThrough', false, null);
                    break;
                case 'subscript':
                    document.execCommand('subscript', false, null);
                    break;
                case 'superscript':
                    document.execCommand('superscript', false, null);
                    break;
                case 'clearFormatting':
                    this.clearFormatting();
                    break;
                case 'hr':
                    document.execCommand('insertHorizontalRule', false, null);
                    break;
                case 'hiddenSep':
                    this.insertHiddenSeparator();
                    break;
                case 'uppercase':
                    this.toggleUppercase();
                    break;
                case 'h1':
                case 'h2':
                case 'h3':
                case 'h4':
                case 'h5':
                case 'h6':
                    document.execCommand('formatBlock', false, action);
                    break;
                case 'left':
                    document.execCommand('justifyLeft', false, null);
                    break;
                case 'center':
                    document.execCommand('justifyCenter', false, null);
                    break;
                case 'right':
                    document.execCommand('justifyRight', false, null);
                    break;
                case 'justify':
                    document.execCommand('justifyFull', false, null);
                    break;
                case 'bullet':
                    document.execCommand('insertUnorderedList', false, null);
                    break;
                case 'number':
                    document.execCommand('insertOrderedList', false, null);
                    break;
                case 'link':
                    this.showLinkModal();
                    break;
                case 'image':
                    this.showImageModal();
                    break;
                case 'video':
                    this.showVideoModal();
                    break;
                case 'table':
                    this.showTableModal();
                    break;
                case 'tableRowAbove':
                    this.tableInsertRow('above');
                    break;
                case 'tableRowBelow':
                    this.tableInsertRow('below');
                    break;
                case 'tableColLeft':
                    this.tableInsertColumn('left');
                    break;
                case 'tableColRight':
                    this.tableInsertColumn('right');
                    break;
                case 'tableDeleteRow':
                    this.tableDeleteRow();
                    break;
                case 'tableDeleteCol':
                    this.tableDeleteColumn();
                    break;
                case 'tableMergeRight':
                    this.tableMergeRight();
                    break;
                case 'tableMergeDown':
                    this.tableMergeDown();
                    break;
                case 'tableSplitCell':
                    this.tableSplitCell();
                    break;
                case 'tableCellProperties':
                    this.showCellPropertiesModal();
                    break;
                case 'templates':
                    this.showTemplatesModal();
                    break;
                case 'undo':
                    this.flushRichHistoryImmediate();
                    this.performRichUndo();
                    break;
                case 'redo':
                    this.flushRichHistoryImmediate();
                    this.performRichRedo();
                    break;
            }
    
            this.content = this.richTextEditor.innerHTML;
            this.updateWordCount();
            // Update active states after command execution
            setTimeout(() => {
                this.updateActiveStates();
            }, 10);
        },

        toggleFullscreen() {
            if (!this.container) return;
            if (this._fullscreenActive || this.container.classList.contains('rte-fullscreen')) {
                this.exitFullscreen();
            } else {
                this.enterFullscreen();
            }
        },

        enterFullscreen() {
            if (!this.container || this._fullscreenActive) return;

            // Re-parent to body so position:fixed is not trapped by transformed ancestors
            this._fsParent = this.container.parentNode;
            this._fsPlaceholder = document.createElement('div');
            this._fsPlaceholder.className = 'rte-fs-placeholder';
            this._fsPlaceholder.setAttribute('aria-hidden', 'true');
            this._fsPlaceholder.style.cssText =
                'width:100%;min-height:' + Math.max(48, this.container.offsetHeight) + 'px;';
            if (this._fsParent) {
                this._fsParent.insertBefore(this._fsPlaceholder, this.container);
            }
            document.body.appendChild(this.container);

            this.container.classList.add('rte-fullscreen');
            document.body.classList.add('rte-fs-open');
            this._fullscreenActive = true;

            // Beat inline layout styles from createEditorLayout
            this.container.style.setProperty('position', 'fixed', 'important');
            this.container.style.setProperty('top', '0', 'important');
            this.container.style.setProperty('right', '0', 'important');
            this.container.style.setProperty('bottom', '0', 'important');
            this.container.style.setProperty('left', '0', 'important');
            this.container.style.setProperty('inset', '0', 'important');
            this.container.style.setProperty('width', '100vw', 'important');
            this.container.style.setProperty('height', '100vh', 'important');
            this.container.style.setProperty('max-width', '100vw', 'important');
            this.container.style.setProperty('z-index', String(RTE_Z_FULLSCREEN), 'important');
            this.container.style.setProperty('display', 'flex', 'important');
            this.container.style.setProperty('flex-direction', 'column', 'important');
            this.container.style.setProperty('gap', '0', 'important');
            this.container.style.setProperty('background', '#fff', 'important');
            this.container.style.setProperty('padding', '12px', 'important');
            this.container.style.setProperty('box-sizing', 'border-box', 'important');
            this.container.style.setProperty('margin', '0', 'important');

            if (this.editorContainer) {
                this.editorContainer.style.setProperty('flex', '1 1 auto', 'important');
                this.editorContainer.style.setProperty('min-height', '0', 'important');
                this.editorContainer.style.setProperty('height', '100%', 'important');
            }
            if (this.richTextEditor && this.currentMode === 'rich') {
                this.richTextEditor.style.setProperty('min-height', 'calc(100vh - 140px)', 'important');
                this.richTextEditor.style.setProperty('max-height', 'none', 'important');
                this.richTextEditor.style.setProperty('height', 'auto', 'important');
                this.richTextEditor.style.setProperty('flex', '1 1 auto', 'important');
            }
            if (this.sourceEditor && this.currentMode === 'source') {
                this.sourceEditor.style.setProperty('min-height', 'calc(100vh - 140px)', 'important');
                this.sourceEditor.style.setProperty('max-height', 'none', 'important');
                this.sourceEditor.style.setProperty('height', 'auto', 'important');
                this.sourceEditor.style.setProperty('flex', '1 1 auto', 'important');
                this.sourceEditor.style.setProperty('display', 'flex', 'important');
                refreshSourceEditor(this.sourceEditor);
            }

            this._syncExpandButton(true);
            if (!this._fullscreenEscHandler) {
                this._fullscreenEscHandler = (e) => {
                    if (e.key === 'Escape' && this._fullscreenActive) {
                        e.preventDefault();
                        this.exitFullscreen();
                    }
                };
                document.addEventListener('keydown', this._fullscreenEscHandler);
            }
        },

        exitFullscreen() {
            if (!this.container) return;

            this.container.classList.remove('rte-fullscreen');
            document.body.classList.remove('rte-fs-open');
            this._fullscreenActive = false;

            // Restore createEditorLayout inline styles
            this.container.style.cssText = `
                display: flex;
                gap: 20px;
                height: 100%;
                width: 100%;
            `;
            if (this.editorContainer) {
                this.editorContainer.style.cssText = `
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                    height: 100%;
                `;
            }
            // Recreate rich/source sizing from options (avoid leftover fullscreen inline height)
            if (this.richTextEditor) {
                const maxLines = parseInt(String(this.options.maxLines ?? 0), 10) || 0;
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
                    display: ${this.currentMode === 'rich' ? 'block' : 'none'};
                `;
            }
            if (this.sourceEditor) {
                this.sourceEditor.style.minHeight = this.options.height || '400px';
                this.sourceEditor.style.maxHeight = '';
                this.sourceEditor.style.flex = '';
                refreshSourceEditor(this.sourceEditor);
            }

            if (this._fsPlaceholder && this._fsParent) {
                this._fsParent.insertBefore(this.container, this._fsPlaceholder);
                this._fsPlaceholder.remove();
            }
            this._fsPlaceholder = null;
            this._fsParent = null;

            this._syncExpandButton(false);
            if (this._fullscreenEscHandler) {
                document.removeEventListener('keydown', this._fullscreenEscHandler);
                this._fullscreenEscHandler = null;
            }
        },

        _syncExpandButton(isFullscreen) {
            if (!this.toolbar) return;
            const btn = this.toolbar.querySelector('[data-action="expand"]');
            if (!btn) return;
            btn.classList.toggle('active', !!isFullscreen);
            btn.title = isFullscreen ? 'Exit fullscreen' : 'Expand editor';
            btn.setAttribute('aria-label', btn.title);
            btn.innerHTML = isFullscreen
                ? '<i class="fas fa-compress" aria-hidden="true"></i>'
                : '<i class="fas fa-expand" aria-hidden="true"></i>';
        },

        toggleSourceMode() {
            if (this.currentMode === 'rich') {
                // Switch to source mode — sanitize chrome then pretty-print
                this.flushRichHistoryImmediate();
                this.sourceEditor.value = formatEditorHtml(sanitizeEditorHtml(this.richTextEditor.innerHTML));
                this.setMode('source');
            } else {
                // Switch to rich mode — sanitize then collapse display indent
                const safe = collapseEditorHtml(sanitizeEditorHtml(this.sourceEditor.value));
                this.sourceEditor.value = safe;
                this.richTextEditor.innerHTML = safe;
                decorateEditorBlocks(this.richTextEditor);
                this.setMode('rich');
                this.resetRichHistory();
            }
            this.updateWordCount();
        },

        setMode(mode) {
            this.currentMode = mode;
    
            if (mode === 'rich') {
                this.richTextEditor.style.display = 'block';
                this.sourceEditor.style.display = 'none';
    
                // Update source button — keep FA icon size consistent with other tools
                const sourceBtn = this.toolbar.querySelector('[data-action="source"]');
                if (sourceBtn) {
                    sourceBtn.innerHTML = '<i class="fas fa-code" aria-hidden="true"></i>';
                    sourceBtn.title = 'HTML Source Mode';
                    sourceBtn.classList.remove('active');
                }
            } else {
                this.richTextEditor.style.display = 'none';
                this.sourceEditor.style.display = 'flex';
                refreshSourceEditor(this.sourceEditor);
                if (typeof this.hideTableToolbar === 'function') this.hideTableToolbar();
                if (typeof this.hideFindPanel === 'function') this.hideFindPanel();
    
                // Update source button — indicate return to rich text
                const sourceBtn = this.toolbar.querySelector('[data-action="source"]');
                if (sourceBtn) {
                    sourceBtn.innerHTML = '<i class="fas fa-eye" aria-hidden="true"></i>';
                    sourceBtn.title = 'Rich Text Mode';
                    sourceBtn.classList.add('active');
                }
            }
        },

        initializeActiveStateTracking() {
            // Initialize active states object
            this.options.toolbar.forEach(item => {
                if (item !== '|') {
                    this.activeStates[item] = false;
                }
            });
        },

        updateActiveStates() {
            if (this.currentMode !== 'rich') return;
    
            const selection = window.getSelection();
            if (!selection.rangeCount) return;
    
            const range = selection.getRangeAt(0);
            const parentElement = range.commonAncestorContainer.nodeType === 1
                ? range.commonAncestorContainer
                : range.commonAncestorContainer.parentElement;
    
            // Only reflect state when selection is in this editor (multi-instance)
            if (!parentElement || !this.richTextEditor.contains(parentElement)) {
                Object.keys(this.activeStates).forEach(k => { this.activeStates[k] = false; });
                this.updateTableToolbarState(null);
                this.updateButtonAppearances();
                return;
            }
    
            // Check formatting states
            this.activeStates.bold = document.queryCommandState('bold');
            this.activeStates.italic = document.queryCommandState('italic');
            this.activeStates.underline = document.queryCommandState('underline');
            this.activeStates.strike = document.queryCommandState('strikeThrough');
    
            // Check alignment
            this.activeStates.left = document.queryCommandValue('justifyLeft') === 'left';
            this.activeStates.center = document.queryCommandValue('justifyCenter') === 'center';
            this.activeStates.right = document.queryCommandValue('justifyRight') === 'right';
            this.activeStates.justify = document.queryCommandValue('justifyFull') === 'justify';
    
            // Check list states
            this.activeStates.bullet = this.isInList(parentElement, 'ul');
            this.activeStates.number = this.isInList(parentElement, 'ol');
    
            // Check heading states
            const headingTag = this.getHeadingTag(parentElement);
            this.activeStates.h1 = headingTag === 'h1';
            this.activeStates.h2 = headingTag === 'h2';
            this.activeStates.h3 = headingTag === 'h3';
            this.activeStates.h4 = headingTag === 'h4';
            this.activeStates.h5 = headingTag === 'h5';
            this.activeStates.h6 = headingTag === 'h6';

            // Sync smart dropdown labels to caret formatting
            if (this.toolbarDropdowns) {
                const blockTag = this.getBlockTag(parentElement) || 'p';
                const formats = this.options.blockFormats || [];
                const knownFormat = formats.some((f) => f.value === blockTag);
                if (this.toolbarDropdowns.formatBlock) {
                    this.toolbarDropdowns.formatBlock.setValue(knownFormat ? blockTag : 'p');
                }

                if (this.toolbarDropdowns.fontName && parentElement) {
                    const fonts = this.options.fonts || [];
                    const family = (window.getComputedStyle(parentElement).fontFamily || '')
                        .split(',')[0]
                        .replace(/['"]/g, '')
                        .trim()
                        .toLowerCase();
                    const match = fonts.find((f) => String(f.value).toLowerCase() === family);
                    this.toolbarDropdowns.fontName.setValue(
                        match ? match.value : (fonts[0] ? fonts[0].value : '')
                    );
                }

                if (this.toolbarDropdowns.fontSize) {
                    const sizes = this.options.fontSizes || [];
                    const sizeValues = sizes.map((s) => s.value).filter(Boolean);
                    let matchedSize = '';
                    let node = parentElement;
                    while (node && this.richTextEditor && this.richTextEditor.contains(node)) {
                        const inline = node.style && node.style.fontSize;
                        if (inline && sizeValues.indexOf(inline) >= 0) {
                            matchedSize = inline;
                            break;
                        }
                        if (node === this.richTextEditor) break;
                        node = node.parentElement;
                    }
                    this.toolbarDropdowns.fontSize.setValue(matchedSize);
                }
            }

            // Enable/disable table structure tools based on cursor location
            this.updateTableToolbarState(parentElement);

            // Update button appearances
            this.updateButtonAppearances();
        },

        isInList(element, listType) {
            if (!element) return false;
            if (element.tagName && element.tagName.toLowerCase() === listType) return true;
            return this.isInList(element.parentElement, listType);
        },

        getHeadingTag(element) {
            if (!element) return null;
            if (element.tagName && /^h[1-6]$/i.test(element.tagName)) {
                return element.tagName.toLowerCase();
            }
            return this.getHeadingTag(element.parentElement);
        },

        getBlockTag(element) {
            if (!element || !this.richTextEditor || !this.richTextEditor.contains(element)) {
                return null;
            }
            const tag = element.tagName && element.tagName.toLowerCase();
            if (tag && /^(p|h[1-6]|blockquote|pre)$/.test(tag)) {
                return tag;
            }
            if (element === this.richTextEditor) {
                return null;
            }
            return this.getBlockTag(element.parentElement);
        },

        updateTableToolbarState(fromElement) {
            const cell = this.getTableCellFromNode(fromElement);
            const table = cell ? cell.closest('table') : null;
            const inTable = !!(table && this.richTextEditor && this.richTextEditor.contains(table));
            const rowCount = inTable ? table.rows.length : 0;
            const colCount = inTable && cell ? cell.parentElement.cells.length : 0;
            const colSpan = inTable && cell ? (parseInt(cell.getAttribute('colspan') || '1', 10) || 1) : 1;
            const rowSpan = inTable && cell ? (parseInt(cell.getAttribute('rowspan') || '1', 10) || 1) : 1;
            const canMergeRight = inTable && cell && (cell.cellIndex + 1) < cell.parentElement.cells.length;
            const canMergeDown = inTable && cell && (cell.parentElement.rowIndex + rowSpan) < table.rows.length;
            const canSplit = inTable && cell && (colSpan > 1 || rowSpan > 1);

            if (!inTable) {
                if (typeof this.hideTableToolbar === 'function') this.hideTableToolbar();
                return;
            }
            if (typeof this.showTableToolbar !== 'function') return;
            const tableToolbar = this.showTableToolbar(table);
            if (!tableToolbar) return;

            const setDisabled = (action, disabled) => {
                const btn = tableToolbar.querySelector('[data-action="' + action + '"]');
                if (btn) btn.disabled = !!disabled;
            };

            setDisabled('tableRowAbove', !inTable);
            setDisabled('tableRowBelow', !inTable);
            setDisabled('tableColLeft', !inTable);
            setDisabled('tableColRight', !inTable);
            setDisabled('tableDeleteRow', !inTable || rowCount <= 1);
            setDisabled('tableDeleteCol', !inTable || colCount <= 1);
            setDisabled('tableMergeRight', !canMergeRight);
            setDisabled('tableMergeDown', !canMergeDown);
            setDisabled('tableSplitCell', !canSplit);
            setDisabled('tableCellProperties', !inTable);
        },

        updateButtonAppearances() {
            Object.keys(this.activeStates).forEach(action => {
                const button = this.toolbar.querySelector(`[data-action="${action}"]`);
                if (button) {
                    if (this.activeStates[action]) {
                        button.classList.add('active');
                    } else {
                        button.classList.remove('active');
                    }
                }
            });
        }
  } as any
);
