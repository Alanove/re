// @ts-nocheck
/**
 * RichTextEditor mixin — dialogs/table.ts
 * Insert / edit tables, rte-table style classes, row & column structure tools,
 * cell merge/split, and table/cell property dialogs.
 */
import { RichTextEditorCore } from '../core';
import { createColorField } from '../color-field';
import { RTE_Z_MODAL } from '../z-index';

Object.assign(
  RichTextEditorCore.prototype,
  {

        getTableBorderOptions() {
            return [
                { value: 'rte-table--directory', label: 'Directory' },
                { value: '', label: 'Default lines' },
                { value: 'rte-table--bordered', label: 'All borders' },
                { value: 'rte-table--borderless', label: 'No borders' },
            ];
        },

        getTableToggleOptions() {
            return [
                { value: 'rte-table--striped', label: 'Striped rows' },
                { value: 'rte-table--hover', label: 'Highlight on hover' },
                { value: 'rte-table--compact', label: 'Compact spacing' },
            ];
        },

        /**
         * Split an existing table className into the border choice, enabled toggles and leftover custom classes.
         */
        resolveTableClassForModal(existingClass) {
            const tokens = (existingClass || '').trim().split(/\s+/).filter(Boolean);
            const borderValues = this.getTableBorderOptions().map((o) => o.value).filter(Boolean);
            const toggleValues = this.getTableToggleOptions().map((o) => o.value);
            let border = '';
            const toggles = [];
            const extras = [];
            tokens.forEach((t) => {
                if (t === 'rte-table') {
                    return;
                }
                if (borderValues.indexOf(t) >= 0) {
                    if (!border) border = t;
                } else if (toggleValues.indexOf(t) >= 0) {
                    toggles.push(t);
                } else {
                    extras.push(t);
                }
            });
            return { border: border, toggles: toggles, extra: extras.join(' ') };
        },

        composeTableModalClassName(modal) {
            const parts = ['rte-table'];
            const add = (t) => {
                if (t && parts.indexOf(t) < 0) parts.push(t);
            };
            const border = modal.querySelector('input[name="tableBorder"]:checked');
            if (border) add(border.value);
            modal.querySelectorAll('.rte-table-class-check').forEach((cb) => {
                if (cb.checked) add(cb.value);
            });
            const extra = modal.querySelector('#tableClassExtra');
            if (extra && extra.value.trim()) {
                extra.value.trim().split(/\s+/).filter(Boolean).forEach(add);
            }
            return parts.join(' ');
        },

        getTableCellFromNode(node) {
            if (!node || !this.richTextEditor) return null;
            let el = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
            while (el && el !== this.richTextEditor) {
                if (el.tagName && /^(TD|TH)$/i.test(el.tagName)) {
                    return this.richTextEditor.contains(el) ? el : null;
                }
                el = el.parentElement;
            }
            return null;
        },

        getActiveTableContext() {
            let node = null;
            if (this.savedSelectionRange) {
                try {
                    node = this.savedSelectionRange.commonAncestorContainer;
                } catch (e) {
                    node = null;
                }
            }
            if (!node) {
                const sel = window.getSelection();
                if (sel && sel.rangeCount) {
                    node = sel.getRangeAt(0).commonAncestorContainer;
                }
            }
            const cell = this.getTableCellFromNode(node);
            if (!cell) return null;
            const row = cell.parentElement;
            const table = cell.closest('table');
            if (!table || !this.richTextEditor.contains(table)) return null;
            return {
                cell: cell,
                row: row,
                table: table,
                rowIndex: row.rowIndex,
                cellIndex: cell.cellIndex,
            };
        },

        ensureTableWrapper(table) {
            if (!table) return null;
            let wrap = table.parentElement;
            if (wrap && wrap.classList && wrap.classList.contains('rte-table-wrap')) {
                return wrap;
            }
            wrap = document.createElement('div');
            wrap.className = 'rte-table-wrap';
            if (table.parentNode) {
                table.parentNode.insertBefore(wrap, table);
                wrap.appendChild(table);
            }
            return wrap;
        },

        buildTableHTML(rows, cols, headerRow = true, className = 'rte-table rte-table--directory', responsive = false) {
            const wrapClass = responsive ? 'rte-table-wrap rte-table-responsive' : 'rte-table-wrap';
            const cls = (className || 'rte-table rte-table--directory').trim();
            let html = '<div class="' + wrapClass + '"><table class="' + cls + '">';
            const bodyStart = headerRow ? 1 : 0;
            if (headerRow) {
                html += '<thead><tr>';
                for (let c = 0; c < cols; c++) {
                    html += '<th scope="col">&nbsp;</th>';
                }
                html += '</tr></thead>';
            }
            html += '<tbody>';
            for (let r = bodyStart; r < rows; r++) {
                html += '<tr>';
                for (let c = 0; c < cols; c++) {
                    html += '<td>&nbsp;</td>';
                }
                html += '</tr>';
            }
            html += '</tbody></table></div>';
            return html;
        },

        _createDialogChoice(type, text, attrs) {
            const label = document.createElement('label');
            label.className = 'rte-td-check';
            const input = document.createElement('input');
            input.type = type;
            Object.keys(attrs || {}).forEach((k) => {
                if (k === 'checked') {
                    input.checked = !!attrs[k];
                } else {
                    input[k] = attrs[k];
                }
            });
            const span = document.createElement('span');
            span.textContent = text;
            label.appendChild(input);
            label.appendChild(span);
            return label;
        },

        _createDialogSection(title) {
            const section = document.createElement('div');
            const heading = document.createElement('div');
            heading.className = 'rte-td-section-title';
            heading.textContent = title;
            section.appendChild(heading);
            return section;
        },

        /**
         * Builds the shared table dialog chrome: overlay, header with close button, scrollable body and footer.
         */
        _createTableDialogShell(title, confirmLabel) {
            const existingModal = document.querySelector('.rte-modal');
            if (existingModal) {
                existingModal.remove();
            }

            const modal = document.createElement('div');
            modal.className = 'rte-modal';
            modal.style.zIndex = String(RTE_Z_MODAL);

            const dialog = document.createElement('div');
            dialog.className = 'rte-td-dialog';
            dialog.setAttribute('role', 'dialog');
            dialog.setAttribute('aria-modal', 'true');
            dialog.setAttribute('aria-label', title);

            const header = document.createElement('div');
            header.className = 'rte-td-header';
            const heading = document.createElement('h3');
            heading.textContent = title;
            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'rte-td-close';
            closeBtn.setAttribute('aria-label', 'Close');
            closeBtn.innerHTML = '&times;';
            closeBtn.addEventListener('click', () => this.closeModal(modal));
            header.appendChild(heading);
            header.appendChild(closeBtn);

            const body = document.createElement('div');
            body.className = 'rte-td-body';

            const footer = document.createElement('div');
            footer.className = 'rte-td-footer';
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'rte-td-cancel';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.addEventListener('click', () => this.closeModal(modal));
            const confirmBtn = document.createElement('button');
            confirmBtn.type = 'button';
            confirmBtn.className = 'rte-td-confirm';
            confirmBtn.textContent = confirmLabel;
            footer.appendChild(cancelBtn);
            footer.appendChild(confirmBtn);

            dialog.appendChild(header);
            dialog.appendChild(body);
            dialog.appendChild(footer);
            modal.appendChild(dialog);

            modal.addEventListener('mousedown', (e) => {
                if (e.target === modal) this.closeModal(modal);
            });
            modal.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.closeModal(modal);
            });

            return { modal, body, confirmBtn };
        },

        _readInlineStyle(el, prop) {
            if (!el || !el.style) return '';
            return (el.style.getPropertyValue(prop) || el.style[prop] || '').trim();
        },

        _setOrClearStyle(el, prop, value) {
            if (!el || !el.style) return;
            if (value == null || value === '') {
                el.style.removeProperty(prop);
            } else {
                // !important so cell/table styles beat editor chrome defaults
                el.style.setProperty(prop, value, 'important');
            }
        },

        _makeNumberField(id, text, value, opts) {
            const field = document.createElement('div');
            field.className = 'rte-td-field';
            const label = document.createElement('label');
            label.htmlFor = id;
            label.textContent = text;
            const input = document.createElement('input');
            input.type = 'text';
            input.id = id;
            input.value = value == null ? '' : String(value);
            if (opts && opts.placeholder) input.placeholder = opts.placeholder;
            field.appendChild(label);
            field.appendChild(input);
            return { field, input };
        },

        _appendColorAndSizeFields(body, styleState, colors) {
            const styleSection = this._createDialogSection('Colors & size');
            const styleWrap = document.createElement('div');
            styleWrap.className = 'rte-td-style-fields';

            const borderColor = createColorField({
                id: 'tableBorderColor',
                label: 'Border color',
                colors: colors,
                initial: styleState.borderColor || '',
                allowEmpty: true,
            });
            styleWrap.appendChild(borderColor.root);

            const borderWidth = this._makeNumberField(
                'tableBorderWidth',
                'Border width',
                styleState.borderWidth || '',
                { placeholder: 'e.g. 1px' }
            );
            styleWrap.appendChild(borderWidth.field);

            const bgColor = createColorField({
                id: 'tableBgColor',
                label: 'Background color',
                colors: colors,
                initial: styleState.backgroundColor || '',
                allowEmpty: true,
            });
            styleWrap.appendChild(bgColor.root);

            const spacing = this._makeNumberField(
                'tableCellSpacing',
                'Cell spacing',
                styleState.cellSpacing || '',
                { placeholder: 'e.g. 4px' }
            );
            styleWrap.appendChild(spacing.field);

            const headerBg = createColorField({
                id: 'tableHeaderBg',
                label: 'Header background',
                colors: colors,
                initial: styleState.headerBackground || '',
                allowEmpty: true,
            });
            styleWrap.appendChild(headerBg.root);

            const headerText = createColorField({
                id: 'tableHeaderText',
                label: 'Header text',
                colors: colors,
                initial: styleState.headerText || '',
                allowEmpty: true,
            });
            styleWrap.appendChild(headerText.root);

            styleSection.appendChild(styleWrap);
            body.appendChild(styleSection);

            return {
                borderColor,
                borderWidth: borderWidth.input,
                bgColor,
                cellSpacing: spacing.input,
                headerBg,
                headerText,
                // Header colors are only pushed to th cells when changed, so per-cell overrides survive.
                headerBgInitial: headerBg.getValueOrEmpty(),
                headerTextInitial: headerText.getValueOrEmpty(),
            };
        },

        _applyTableInlineStyles(table, fields) {
            if (!table || !fields) return;
            const borderColor = fields.borderColor.getValueOrEmpty();
            const borderWidth = (fields.borderWidth.value || '').trim();
            const bg = fields.bgColor.getValueOrEmpty();
            const spacing = (fields.cellSpacing.value || '').trim();

            this._setOrClearStyle(table, 'border-color', borderColor);
            this._setOrClearStyle(table, 'border-width', borderWidth);
            if (borderColor || borderWidth) {
                this._setOrClearStyle(table, 'border-style', 'solid');
            } else {
                this._setOrClearStyle(table, 'border-style', '');
            }
            this._setOrClearStyle(table, 'background-color', bg);
            if (spacing) {
                this._setOrClearStyle(table, 'border-spacing', spacing);
                this._setOrClearStyle(table, 'border-collapse', 'separate');
            } else {
                this._setOrClearStyle(table, 'border-spacing', '');
                this._setOrClearStyle(table, 'border-collapse', '');
            }

            const headerCells = Array.from(table.querySelectorAll('th'))
                .filter((th) => th.closest('table') === table);
            const headerBg = fields.headerBg ? fields.headerBg.getValueOrEmpty() : '';
            const headerText = fields.headerText ? fields.headerText.getValueOrEmpty() : '';
            if (fields.headerBg && headerBg !== fields.headerBgInitial) {
                headerCells.forEach((th) => this._setOrClearStyle(th, 'background-color', headerBg));
            }
            if (fields.headerText && headerText !== fields.headerTextInitial) {
                headerCells.forEach((th) => this._setOrClearStyle(th, 'color', headerText));
            }
        },

        _createInsertSizeGrid(rowInput, colInput) {
            const GRID_ROWS = 8;
            const GRID_COLS = 10;
            const wrap = document.createElement('div');
            wrap.className = 'rte-td-size-grid-wrap';

            const grid = document.createElement('div');
            grid.className = 'rte-td-size-grid';
            grid.style.gridTemplateColumns = 'repeat(' + GRID_COLS + ', 1fr)';

            const caption = document.createElement('div');
            caption.className = 'rte-td-size-grid-caption';
            caption.textContent = '3 × 3';

            let selectedR = 3;
            let selectedC = 3;

            const highlight = (r, c) => {
                selectedR = r;
                selectedC = c;
                caption.textContent = r + ' × ' + c;
                grid.querySelectorAll('.rte-td-size-cell').forEach((cell) => {
                    const cr = parseInt(cell.getAttribute('data-r'), 10);
                    const cc = parseInt(cell.getAttribute('data-c'), 10);
                    cell.classList.toggle('is-selected', cr <= r && cc <= c);
                });
            };

            for (let r = 1; r <= GRID_ROWS; r++) {
                for (let c = 1; c <= GRID_COLS; c++) {
                    const cell = document.createElement('button');
                    cell.type = 'button';
                    cell.className = 'rte-td-size-cell';
                    cell.setAttribute('data-r', String(r));
                    cell.setAttribute('data-c', String(c));
                    cell.setAttribute('aria-label', r + ' by ' + c);
                    cell.addEventListener('mouseenter', () => highlight(r, c));
                    cell.addEventListener('click', (e) => {
                        e.preventDefault();
                        highlight(r, c);
                        rowInput.value = String(r);
                        colInput.value = String(c);
                    });
                    grid.appendChild(cell);
                }
            }

            grid.addEventListener('mouseleave', () => {
                const rr = Math.max(1, Math.min(GRID_ROWS, parseInt(rowInput.value, 10) || 3));
                const cc = Math.max(1, Math.min(GRID_COLS, parseInt(colInput.value, 10) || 3));
                highlight(rr, cc);
            });

            const syncFromInputs = () => {
                const rr = Math.max(1, parseInt(rowInput.value, 10) || 3);
                const cc = Math.max(1, parseInt(colInput.value, 10) || 3);
                highlight(Math.min(rr, GRID_ROWS), Math.min(cc, GRID_COLS));
            };
            rowInput.addEventListener('input', syncFromInputs);
            colInput.addEventListener('input', syncFromInputs);

            wrap.appendChild(grid);
            wrap.appendChild(caption);
            highlight(3, 3);
            return wrap;
        },

        _appendTableStyleFields(body, resolved, responsiveChecked, styleState) {
            const border = (resolved && resolved.border) || '';
            const toggles = (resolved && resolved.toggles) || [];
            const extra = (resolved && resolved.extra) || '';
            const colors = (this.options && this.options.colors) || [];

            const borderSection = this._createDialogSection('Borders');
            const borderGrid = document.createElement('div');
            borderGrid.className = 'rte-td-grid';
            this.getTableBorderOptions().forEach((opt) => {
                borderGrid.appendChild(
                    this._createDialogChoice('radio', opt.label, {
                        name: 'tableBorder',
                        value: opt.value,
                        checked: opt.value === border,
                    })
                );
            });
            borderSection.appendChild(borderGrid);
            body.appendChild(borderSection);

            const lookSection = this._createDialogSection('Look');
            const lookGrid = document.createElement('div');
            lookGrid.className = 'rte-td-grid';
            this.getTableToggleOptions().forEach((opt) => {
                lookGrid.appendChild(
                    this._createDialogChoice('checkbox', opt.label, {
                        className: 'rte-table-class-check',
                        value: opt.value,
                        checked: toggles.indexOf(opt.value) >= 0,
                    })
                );
            });
            lookGrid.appendChild(
                this._createDialogChoice('checkbox', 'Scroll on mobile', {
                    id: 'tableResponsive',
                    checked: !!responsiveChecked,
                    title: 'Lets wide tables scroll sideways on small screens',
                })
            );
            lookSection.appendChild(lookGrid);
            body.appendChild(lookSection);

            const styleFields = this._appendColorAndSizeFields(
                body,
                styleState || {},
                colors
            );

            const advanced = document.createElement('details');
            advanced.className = 'rte-advanced';
            advanced.open = !!extra;
            const summary = document.createElement('summary');
            summary.textContent = 'Advanced';
            const extraLabel = document.createElement('label');
            extraLabel.textContent = 'Extra CSS classes';
            extraLabel.htmlFor = 'tableClassExtra';
            const extraInput = document.createElement('input');
            extraInput.type = 'text';
            extraInput.id = 'tableClassExtra';
            extraInput.placeholder = 'e.g. my-custom-class';
            extraInput.value = extra;
            advanced.appendChild(summary);
            advanced.appendChild(extraLabel);
            advanced.appendChild(extraInput);
            body.appendChild(advanced);

            return styleFields;
        },

        showTableModal() {
            if (this.currentMode === 'source') {
                return;
            }

            const ctx = this.getActiveTableContext();
            if (ctx && ctx.table) {
                this.showTablePropertiesModal(ctx.table);
                return;
            }

            this.showInsertTableModal();
        },

        showInsertTableModal() {
            const selection = window.getSelection();
            let savedRange = null;
            if (selection.rangeCount > 0) {
                savedRange = selection.getRangeAt(0).cloneRange();
            }

            const { modal, body, confirmBtn: insertBtn } = this._createTableDialogShell('Insert Table', 'Insert');

            const makeNumberField = (id, text, max) => {
                const field = document.createElement('div');
                field.className = 'rte-td-field';
                const label = document.createElement('label');
                label.htmlFor = id;
                label.textContent = text;
                const input = document.createElement('input');
                input.type = 'number';
                input.id = id;
                input.min = 1;
                input.max = max;
                input.value = '3';
                field.appendChild(label);
                field.appendChild(input);
                return { field, input };
            };

            const sizeSection = this._createDialogSection('Size');
            const rows = makeNumberField('tableRows', 'Rows', 20);
            const cols = makeNumberField('tableCols', 'Columns', 10);
            const rowInput = rows.input;
            const colInput = cols.input;
            sizeSection.appendChild(this._createInsertSizeGrid(rowInput, colInput));

            const sizeRow = document.createElement('div');
            sizeRow.className = 'rte-td-size';
            const headerLabel = this._createDialogChoice('checkbox', 'Header row', { id: 'tableHeaderRow', checked: true });
            const headerCheck = headerLabel.querySelector('input');
            sizeRow.appendChild(rows.field);
            sizeRow.appendChild(cols.field);
            sizeRow.appendChild(headerLabel);
            sizeSection.appendChild(sizeRow);
            body.appendChild(sizeSection);

            const styleFields = this._appendTableStyleFields(
                body,
                { border: 'rte-table--directory', toggles: [], extra: '' },
                false,
                {}
            );

            insertBtn.addEventListener('click', () => {
                const rows = Math.max(1, Math.min(20, parseInt(rowInput.value, 10) || 3));
                const cols = Math.max(1, Math.min(10, parseInt(colInput.value, 10) || 3));
                const headerRow = headerCheck.checked;
                const className = this.composeTableModalClassName(modal);
                const responsive = !!(modal.querySelector('#tableResponsive') && modal.querySelector('#tableResponsive').checked);
                const tableHTML = this.buildTableHTML(rows, cols, headerRow, className, responsive);

                this.richTextEditor.focus();

                let range = null;
                if (savedRange) {
                    try {
                        const container = savedRange.commonAncestorContainer;
                        const node = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
                        if (node && this.richTextEditor.contains(node)) {
                            const sel = window.getSelection();
                            sel.removeAllRanges();
                            sel.addRange(savedRange);
                            range = savedRange;
                        }
                    } catch (e) {
                        // ignore
                    }
                }
                if (!range) {
                    const sel = window.getSelection();
                    if (sel.rangeCount > 0) {
                        const r = sel.getRangeAt(0);
                        const container = r.commonAncestorContainer;
                        const node = container.nodeType === Node.TEXT_NODE ? container.parentElement : container;
                        if (node && this.richTextEditor.contains(node)) {
                            range = r;
                        }
                    }
                }
                if (!range) {
                    range = document.createRange();
                    range.selectNodeContents(this.richTextEditor);
                    range.collapse(false);
                }

                range.deleteContents();
                const temp = document.createElement('div');
                temp.innerHTML = tableHTML;
                const fragment = document.createDocumentFragment();
                while (temp.firstChild) {
                    fragment.appendChild(temp.firstChild);
                }
                range.insertNode(fragment);

                const insertedTable = this.richTextEditor.querySelector(
                    '.rte-table-wrap:last-of-type table, table.rte-table:last-of-type'
                );
                if (insertedTable) {
                    this._applyTableInlineStyles(insertedTable, styleFields);
                }

                const firstCell = this.richTextEditor.querySelector('.rte-table td, .rte-table th, table.rte-table td, table.rte-table th');
                if (firstCell) {
                    this._focusTableCell(firstCell);
                }

                this.richTextEditor.dispatchEvent(new Event('input'));
                this.notifyChange();
                this.updateActiveStates();
                this.closeModal(modal);
            });

            document.body.appendChild(modal);
            rowInput.focus();
            rowInput.select();
        },

        showTablePropertiesModal(table) {
            if (!table) return;

            const wrap = table.parentElement && table.parentElement.classList.contains('rte-table-wrap')
                ? table.parentElement
                : null;
            const resolved = this.resolveTableClassForModal(table.className || '');
            const responsiveChecked = !!(wrap && wrap.classList.contains('rte-table-responsive'));
            const styleState = {
                borderColor: this._readInlineStyle(table, 'border-color'),
                borderWidth: this._readInlineStyle(table, 'border-width'),
                backgroundColor: this._readInlineStyle(table, 'background-color'),
                cellSpacing: this._readInlineStyle(table, 'border-spacing'),
                headerBackground: '',
                headerText: '',
            };
            const firstHeader = Array.from(table.querySelectorAll('th')).find((th) => th.closest('table') === table);
            if (firstHeader) {
                styleState.headerBackground = this._readInlineStyle(firstHeader, 'background-color');
                styleState.headerText = this._readInlineStyle(firstHeader, 'color');
            }

            const { modal, body, confirmBtn: saveBtn } = this._createTableDialogShell('Table Properties', 'Apply');
            const styleFields = this._appendTableStyleFields(body, resolved, responsiveChecked, styleState);

            saveBtn.addEventListener('click', () => {
                const className = this.composeTableModalClassName(modal);
                const responsive = !!(modal.querySelector('#tableResponsive') && modal.querySelector('#tableResponsive').checked);
                table.className = className;
                this._applyTableInlineStyles(table, styleFields);
                const wrapper = this.ensureTableWrapper(table);
                if (wrapper) {
                    wrapper.classList.toggle('rte-table-responsive', responsive);
                    if (!wrapper.classList.contains('rte-table-wrap')) {
                        wrapper.classList.add('rte-table-wrap');
                    }
                }
                this.richTextEditor.dispatchEvent(new Event('input'));
                this.notifyChange();
                this.updateActiveStates();
                this.closeModal(modal);
            });

            document.body.appendChild(modal);
            saveBtn.focus();
        },

        showCellPropertiesModal(cellArg) {
            if (this.currentMode === 'source') return;
            const ctx = this.getActiveTableContext();
            const cell = cellArg || (ctx && ctx.cell);
            if (!cell) return;

            const colors = (this.options && this.options.colors) || [];
            const styleState = {
                borderColor: this._readInlineStyle(cell, 'border-color'),
                borderWidth: this._readInlineStyle(cell, 'border-width'),
                backgroundColor: this._readInlineStyle(cell, 'background-color'),
                padding: this._readInlineStyle(cell, 'padding'),
                textAlign: this._readInlineStyle(cell, 'text-align') || '',
                verticalAlign: this._readInlineStyle(cell, 'vertical-align') || '',
            };

            const { modal, body, confirmBtn: saveBtn } = this._createTableDialogShell('Cell Properties', 'Apply');

            const styleSection = this._createDialogSection('Colors & size');
            const styleWrap = document.createElement('div');
            styleWrap.className = 'rte-td-style-fields';

            const borderColor = createColorField({
                id: 'cellBorderColor',
                label: 'Border color',
                colors: colors,
                initial: styleState.borderColor || '',
                allowEmpty: true,
            });
            styleWrap.appendChild(borderColor.root);

            const borderWidth = this._makeNumberField(
                'cellBorderWidth',
                'Border width',
                styleState.borderWidth || '',
                { placeholder: 'e.g. 1px' }
            );
            styleWrap.appendChild(borderWidth.field);

            const bgColor = createColorField({
                id: 'cellBgColor',
                label: 'Background color',
                colors: colors,
                initial: styleState.backgroundColor || '',
                allowEmpty: true,
            });
            styleWrap.appendChild(bgColor.root);

            const padding = this._makeNumberField(
                'cellPadding',
                'Padding',
                styleState.padding || '',
                { placeholder: 'e.g. 8px' }
            );
            styleWrap.appendChild(padding.field);

            styleSection.appendChild(styleWrap);
            body.appendChild(styleSection);

            const alignSection = this._createDialogSection('Alignment');
            const hRow = document.createElement('div');
            hRow.className = 'rte-td-align-row';
            const hLabel = document.createElement('div');
            hLabel.className = 'rte-td-align-label';
            hLabel.textContent = 'Horizontal';
            hRow.appendChild(hLabel);
            const hGroup = document.createElement('div');
            hGroup.className = 'rte-td-align-group';
            // Use a sentinel for "default" — empty radio value becomes "on" in browsers
            const hCurrent = styleState.textAlign || 'default';
            ['default', 'left', 'center', 'right', 'justify'].forEach((val, i) => {
                const labels = ['Default', 'Left', 'Center', 'Right', 'Justify'];
                hGroup.appendChild(
                    this._createDialogChoice('radio', labels[i], {
                        name: 'cellTextAlign',
                        value: val,
                        checked: hCurrent === val || (val === 'default' && !styleState.textAlign),
                    })
                );
            });
            hRow.appendChild(hGroup);
            alignSection.appendChild(hRow);

            const vRow = document.createElement('div');
            vRow.className = 'rte-td-align-row';
            const vLabel = document.createElement('div');
            vLabel.className = 'rte-td-align-label';
            vLabel.textContent = 'Vertical';
            vRow.appendChild(vLabel);
            const vGroup = document.createElement('div');
            vGroup.className = 'rte-td-align-group';
            const vCurrent = styleState.verticalAlign || 'default';
            ['default', 'top', 'middle', 'bottom'].forEach((val, i) => {
                const labels = ['Default', 'Top', 'Middle', 'Bottom'];
                vGroup.appendChild(
                    this._createDialogChoice('radio', labels[i], {
                        name: 'cellVerticalAlign',
                        value: val,
                        checked: vCurrent === val || (val === 'default' && !styleState.verticalAlign),
                    })
                );
            });
            vRow.appendChild(vGroup);
            alignSection.appendChild(vRow);
            body.appendChild(alignSection);

            saveBtn.addEventListener('click', () => {
                const bc = borderColor.getValueOrEmpty();
                const bw = (borderWidth.input.value || '').trim();
                const bg = bgColor.getValueOrEmpty();
                const pad = (padding.input.value || '').trim();
                const hAlign = modal.querySelector('input[name="cellTextAlign"]:checked');
                const vAlign = modal.querySelector('input[name="cellVerticalAlign"]:checked');
                const hVal = hAlign && hAlign.value !== 'default' ? hAlign.value : '';
                const vVal = vAlign && vAlign.value !== 'default' ? vAlign.value : '';

                this._setOrClearStyle(cell, 'border-color', bc);
                this._setOrClearStyle(cell, 'border-width', bw);
                if (bc || bw) {
                    this._setOrClearStyle(cell, 'border-style', 'solid');
                } else {
                    this._setOrClearStyle(cell, 'border-style', '');
                }
                this._setOrClearStyle(cell, 'background-color', bg);
                this._setOrClearStyle(cell, 'padding', pad);
                this._setOrClearStyle(cell, 'text-align', hVal);
                this._setOrClearStyle(cell, 'vertical-align', vVal);

                this._focusTableCell(cell);
                this.richTextEditor.dispatchEvent(new Event('input'));
                this.notifyChange();
                this.updateActiveStates();
                this.closeModal(modal);
            });

            document.body.appendChild(modal);
            saveBtn.focus();
        },

        _isHeaderOnlyRow(row) {
            if (!row || !row.cells) return false;
            for (let i = 0; i < row.cells.length; i++) {
                if (row.cells[i].tagName.toLowerCase() !== 'th') return false;
            }
            return row.cells.length > 0;
        },

        _focusTableCell(cell) {
            if (!cell) return;
            this.richTextEditor.focus();
            const sel = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(cell);
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
            try {
                this.savedSelectionRange = range.cloneRange();
            } catch (e) {
                this.savedSelectionRange = null;
            }
        },

        _afterTableMutation(focusCell) {
            if (focusCell) {
                this._focusTableCell(focusCell);
            }
            this.richTextEditor.dispatchEvent(new Event('input'));
            this.notifyChange();
            this.updateActiveStates();
        },

        tableInsertRow(position) {
            const ctx = this.getActiveTableContext();
            if (!ctx) return;
            const { row, table, cellIndex } = ctx;
            const colCount = row.cells.length;
            if (colCount < 1) return;

            const useTh = this._isHeaderOnlyRow(row);
            const newRow = table.insertRow(position === 'above' ? row.rowIndex : row.rowIndex + 1);
            for (let i = 0; i < colCount; i++) {
                const cell = document.createElement(useTh ? 'th' : 'td');
                cell.innerHTML = '&nbsp;';
                newRow.appendChild(cell);
            }
            const focus = newRow.cells[Math.min(cellIndex, newRow.cells.length - 1)] || newRow.cells[0];
            this._afterTableMutation(focus);
        },

        tableInsertColumn(position) {
            const ctx = this.getActiveTableContext();
            if (!ctx) return;
            const { cell, table, cellIndex } = ctx;
            const insertAt = position === 'left' ? cellIndex : cellIndex + 1;

            let focusCell = null;
            for (let r = 0; r < table.rows.length; r++) {
                const row = table.rows[r];
                const tag = this._isHeaderOnlyRow(row) ? 'th' : 'td';
                const newCell = document.createElement(tag);
                newCell.innerHTML = '&nbsp;';
                if (insertAt >= row.cells.length) {
                    row.appendChild(newCell);
                } else {
                    row.insertBefore(newCell, row.cells[insertAt]);
                }
                if (row === cell.parentElement) {
                    focusCell = newCell;
                }
            }
            this._afterTableMutation(focusCell);
        },

        tableDeleteRow() {
            const ctx = this.getActiveTableContext();
            if (!ctx) return;
            const { row, table, rowIndex, cellIndex } = ctx;
            if (table.rows.length <= 1) return;

            table.deleteRow(rowIndex);
            const nextIndex = Math.min(rowIndex, table.rows.length - 1);
            const nextRow = table.rows[nextIndex];
            const focus = nextRow
                ? (nextRow.cells[Math.min(cellIndex, nextRow.cells.length - 1)] || nextRow.cells[0])
                : null;
            this._afterTableMutation(focus);
        },

        tableDeleteColumn() {
            const ctx = this.getActiveTableContext();
            if (!ctx) return;
            const { table, cellIndex, rowIndex } = ctx;
            if (!table.rows.length || table.rows[0].cells.length <= 1) return;

            for (let r = table.rows.length - 1; r >= 0; r--) {
                const row = table.rows[r];
                if (cellIndex < row.cells.length) {
                    row.deleteCell(cellIndex);
                }
            }
            const nextCol = Math.min(cellIndex, table.rows[0].cells.length - 1);
            const focusRow = table.rows[Math.min(rowIndex, table.rows.length - 1)];
            const focus = focusRow ? focusRow.cells[nextCol] : null;
            this._afterTableMutation(focus);
        },

        _cellSpan(cell, attr) {
            return Math.max(1, parseInt(cell.getAttribute(attr) || '1', 10) || 1);
        },

        _appendCellContent(target, source) {
            if (!target || !source) return;
            const srcText = (source.textContent || '').replace(/\u00a0/g, ' ').trim();
            if (!srcText && source.childNodes.length <= 1) return;
            if (target.innerHTML === '&nbsp;' || !(target.textContent || '').replace(/\u00a0/g, ' ').trim()) {
                target.innerHTML = '';
            } else {
                target.appendChild(document.createElement('br'));
            }
            while (source.firstChild) {
                target.appendChild(source.firstChild);
            }
        },

        tableMergeRight() {
            const ctx = this.getActiveTableContext();
            if (!ctx) return;
            const { cell, row } = ctx;
            const colSpan = this._cellSpan(cell, 'colspan');
            const neighborIndex = cell.cellIndex + 1;
            if (neighborIndex >= row.cells.length) return;
            const neighbor = row.cells[neighborIndex];
            if (!neighbor) return;
            if (this._cellSpan(neighbor, 'rowspan') !== this._cellSpan(cell, 'rowspan')) return;

            const neighborSpan = this._cellSpan(neighbor, 'colspan');
            this._appendCellContent(cell, neighbor);
            cell.colSpan = colSpan + neighborSpan;
            row.deleteCell(neighborIndex);
            this._afterTableMutation(cell);
        },

        tableMergeDown() {
            const ctx = this.getActiveTableContext();
            if (!ctx) return;
            const { cell, table, rowIndex, cellIndex } = ctx;
            const rowSpan = this._cellSpan(cell, 'rowspan');
            const belowIndex = rowIndex + rowSpan;
            if (belowIndex >= table.rows.length) return;
            const belowRow = table.rows[belowIndex];
            if (!belowRow || cellIndex >= belowRow.cells.length) return;
            const below = belowRow.cells[cellIndex];
            if (!below) return;
            if (this._cellSpan(below, 'colspan') !== this._cellSpan(cell, 'colspan')) return;

            const belowRowSpan = this._cellSpan(below, 'rowspan');
            this._appendCellContent(cell, below);
            cell.rowSpan = rowSpan + belowRowSpan;
            belowRow.deleteCell(cellIndex);
            this._afterTableMutation(cell);
        },

        tableSplitCell() {
            const ctx = this.getActiveTableContext();
            if (!ctx) return;
            const { cell, row, table, rowIndex, cellIndex } = ctx;
            const colSpan = this._cellSpan(cell, 'colspan');
            const rowSpan = this._cellSpan(cell, 'rowspan');
            if (colSpan <= 1 && rowSpan <= 1) return;

            const tag = cell.tagName.toLowerCase() === 'th' ? 'th' : 'td';
            cell.removeAttribute('colspan');
            cell.removeAttribute('rowspan');

            // Restore cells to the right in the same row
            for (let c = 1; c < colSpan; c++) {
                const newCell = document.createElement(tag);
                newCell.innerHTML = '&nbsp;';
                if (cellIndex + c >= row.cells.length) {
                    row.appendChild(newCell);
                } else {
                    row.insertBefore(newCell, row.cells[cellIndex + c]);
                }
            }

            // Restore cells in rows below for each column of the span
            for (let r = 1; r < rowSpan; r++) {
                const targetRow = table.rows[rowIndex + r];
                if (!targetRow) continue;
                for (let c = 0; c < colSpan; c++) {
                    const newCell = document.createElement(tag);
                    newCell.innerHTML = '&nbsp;';
                    const insertAt = Math.min(cellIndex + c, targetRow.cells.length);
                    if (insertAt >= targetRow.cells.length) {
                        targetRow.appendChild(newCell);
                    } else {
                        targetRow.insertBefore(newCell, targetRow.cells[insertAt]);
                    }
                }
            }

            this._afterTableMutation(cell);
        },

  } as any
);
