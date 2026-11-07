// @ts-nocheck
/**
 * RichTextEditor mixin — table-toolbar.ts
 * Contextual table tools shown above the table that holds the caret.
 */
import { RichTextEditorCore } from './core';
import { RTE_Z_CONTEXT_TOOLBAR } from './z-index';

const OUTSIDE_IGNORE_SELECTOR =
    '.rte-dropdown-menu, .rte-insert-menu, .rte-color-palette, .rte-symbol-picker, .rte-modal, .rte-templates-modal, #templatesModal, .rte-find-panel';

Object.assign(
  RichTextEditorCore.prototype,
  {
        /** Table tools are only offered when the main toolbar can insert or edit tables. */
        hasTableTools() {
            return (this.options.toolbar || []).some(
                (item) => typeof item === 'string' && item.indexOf('table') === 0
            );
        },

        createTableToolbar() {
            if (!this.hasTableTools()) return null;
            const items = (this.options.tableToolbar || []).filter(Boolean);
            if (!items.length) return null;

            const bar = document.createElement('div');
            bar.className = 'rte-table-toolbar';
            bar.setAttribute('role', 'toolbar');
            bar.setAttribute('aria-label', 'Table tools');
            bar.hidden = true;
            bar.style.cssText = 'position: fixed; z-index: ' + RTE_Z_CONTEXT_TOOLBAR + ';';
            this.appendToolbarItems(items, bar);

            // Keep the caret in the cell: save the selection and stop the button stealing focus.
            bar.addEventListener('mousedown', (e) => {
                e.preventDefault();
                const sel = window.getSelection();
                if (!sel || !sel.rangeCount) return;
                const range = sel.getRangeAt(0);
                const ancestor = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
                    ? range.commonAncestorContainer
                    : range.commonAncestorContainer.parentElement;
                if (ancestor && this.richTextEditor && this.richTextEditor.contains(ancestor)) {
                    try {
                        this.savedSelectionRange = range.cloneRange();
                    } catch (err) {
                        this.savedSelectionRange = null;
                    }
                }
            });

            this.tableToolbar = bar;
            return bar;
        },

        /** Show the table toolbar above `table`; returns the toolbar element (or null). */
        showTableToolbar(table) {
            if (!table || this.currentMode !== 'rich') {
                this.hideTableToolbar();
                return null;
            }
            const bar = this.tableToolbar || this.createTableToolbar();
            if (!bar) return null;
            if (bar.parentNode !== document.body) {
                document.body.appendChild(bar);
            }
            this._tableToolbarTarget = table;
            bar.hidden = false;
            bar.classList.add('is-open');
            this.positionTableToolbar();
            this.bindTableToolbarListeners();
            return bar;
        },

        positionTableToolbar() {
            const bar = this.tableToolbar;
            const table = this._tableToolbarTarget;
            if (!bar || bar.hidden || !table) return;
            if (!table.isConnected || !this.richTextEditor || !this.richTextEditor.contains(table)) {
                this.hideTableToolbar();
                return;
            }
            const tableRect = table.getBoundingClientRect();
            const editorRect = this.richTextEditor.getBoundingClientRect();
            const visibleTop = Math.max(tableRect.top, editorRect.top);
            const visibleBottom = Math.min(tableRect.bottom, editorRect.bottom);
            if (visibleBottom <= visibleTop) {
                bar.style.visibility = 'hidden';
                return;
            }
            bar.style.visibility = '';

            const gap = 6;
            const margin = 8;
            const barHeight = bar.offsetHeight || 36;
            const barWidth = bar.offsetWidth || 0;
            let top = visibleTop - barHeight - gap;
            if (top < margin) {
                top = Math.min(visibleBottom + gap, window.innerHeight - barHeight - margin);
            }
            let left = Math.max(tableRect.left, editorRect.left);
            if (left + barWidth > window.innerWidth - margin) {
                left = Math.max(margin, window.innerWidth - barWidth - margin);
            }
            if (left < margin) left = margin;
            bar.style.top = top + 'px';
            bar.style.left = left + 'px';
        },

        bindTableToolbarListeners() {
            if (this._tableToolbarBound) return;
            this._tableToolbarBound = true;
            this._repositionTableToolbar = () => this.positionTableToolbar();
            this._onTableToolbarDocPointer = (e) => {
                const target = e.target && e.target.nodeType === Node.ELEMENT_NODE
                    ? e.target
                    : e.target && e.target.parentElement;
                if (!target) return;
                if (this.richTextEditor && this.richTextEditor.contains(target)) return;
                if (this.tableToolbar && this.tableToolbar.contains(target)) return;
                if (this.toolbar && this.toolbar.contains(target)) return;
                if (typeof target.closest === 'function' && target.closest(OUTSIDE_IGNORE_SELECTOR)) return;
                this.hideTableToolbar();
            };
            window.addEventListener('scroll', this._repositionTableToolbar, true);
            window.addEventListener('resize', this._repositionTableToolbar);
            document.addEventListener('mousedown', this._onTableToolbarDocPointer, true);
        },

        unbindTableToolbarListeners() {
            if (!this._tableToolbarBound) return;
            this._tableToolbarBound = false;
            window.removeEventListener('scroll', this._repositionTableToolbar, true);
            window.removeEventListener('resize', this._repositionTableToolbar);
            document.removeEventListener('mousedown', this._onTableToolbarDocPointer, true);
        },

        hideTableToolbar() {
            this._tableToolbarTarget = null;
            this.unbindTableToolbarListeners();
            if (!this.tableToolbar) return;
            this.tableToolbar.hidden = true;
            this.tableToolbar.classList.remove('is-open');
        },

        teardownTableToolbar() {
            this.hideTableToolbar();
            if (this.tableToolbar && this.tableToolbar.parentNode) {
                this.tableToolbar.parentNode.removeChild(this.tableToolbar);
            }
            this.tableToolbar = null;
        }
  } as any
);
