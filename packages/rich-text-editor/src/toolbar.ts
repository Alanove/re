// @ts-nocheck
/**
 * RichTextEditor mixin — toolbar.ts
 */
import { RichTextEditorCore } from './core';
import { RTE_Z_POPUP } from './z-index';

let openMiniToolbarEditor = null;

export function isTableContextAction(item) {
    return typeof item === 'string' && item.indexOf('table') === 0 && item !== 'table';
}

function isMiniToolbarChrome(target, instance) {
    if (!target || !instance) return false;
    const node = target.nodeType === Node.ELEMENT_NODE ? target : target.parentElement;
    if (!node || typeof node.closest !== 'function') return false;
    if (instance.toolbar && (instance.toolbar === node || instance.toolbar.contains(node))) {
        return true;
    }
    return !!node.closest(
        '.rte-dropdown-menu, .rte-insert-menu, .rte-color-palette, .rte-symbol-picker, .rte-modal, .rte-templates-modal, #templatesModal, ' +
        '.rte-table-toolbar, .rte-find-panel, .rte-preview-modal'
    );
}

Object.assign(
  RichTextEditorCore.prototype,
  {

        createToolbar() {
            this.toolbar = document.createElement('div');
            this.toolbar.className = 'rte-toolbar';
            this.toolbar.style.cssText = `
                border: 1px solid #ccc;
                border-bottom: none;
                background: #f8f9fa;
                padding: 8px;
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                align-items: center;
            `;
    
            this.appendToolbarItems(this.getMainToolbarItems(), this.toolbar);
    
            // Save selection on mousedown so it's available when the button click runs (multi-instance)
            this.toolbar.addEventListener('mousedown', (e) => {
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
                    }
                }
            });
    
            this.editorContainer.appendChild(this.toolbar);
            if (this.isFloatingToolbar()) {
                this.toolbar.classList.add('rte-toolbar-floating');
                this.toolbar.hidden = true;
            }
        },

        /**
         * Main toolbar items without the contextual table tools (those live in the
         * table toolbar). Collapses separators left dangling by the removal.
         */
        getMainToolbarItems() {
            const items = (this.options.toolbar || []).filter((item) => !isTableContextAction(item));
            const out = [];
            items.forEach((item) => {
                if (item === '|' && (!out.length || out[out.length - 1] === '|')) return;
                out.push(item);
            });
            while (out.length && out[out.length - 1] === '|') out.pop();
            return out;
        },

        appendToolbarItems(items, parent) {
            items.forEach((item) => {
                if (item === '|') {
                    const separator = document.createElement('div');
                    separator.className = 'rte-toolbar-separator';
                    separator.style.cssText = 'width: 1px; height: 20px; background: #ccc; margin: 0 4px;';
                    parent.appendChild(separator);
                } else {
                    this.createToolbarButton(item, parent);
                }
            });
        },

        initMiniFloatingToolbar() {
            if (!this.isFloatingToolbar() || !this.toolbar || this._miniFloatingBound) {
                return;
            }
            this._miniFloatingBound = true;
            this._miniToolbarOpen = false;

            this._showMiniToolbar = () => {
                this.showMiniFloatingToolbar();
            };
            this._onMiniDocPointer = (e) => {
                if (isMiniToolbarChrome(e.target, this)) return;
                if (this.richTextEditor && this.richTextEditor.contains(e.target)) return;
                this.hideMiniFloatingToolbar();
            };
            this._onMiniFocusIn = (e) => {
                if (isMiniToolbarChrome(e.target, this)) return;
                if (this.richTextEditor && this.richTextEditor.contains(e.target)) return;
                this.hideMiniFloatingToolbar();
            };
            this._repositionMiniToolbar = () => {
                this.positionMiniFloatingToolbar();
            };

            if (this.richTextEditor) {
                this.richTextEditor.addEventListener('focus', this._showMiniToolbar);
                this.richTextEditor.addEventListener('click', this._showMiniToolbar);
            }
            this.toolbar.addEventListener('mousedown', (e) => {
                e.preventDefault();
            });
        },

        showMiniFloatingToolbar() {
            if (!this.toolbar || !this.isFloatingToolbar()) return;
            if (openMiniToolbarEditor && openMiniToolbarEditor !== this) {
                openMiniToolbarEditor.hideMiniFloatingToolbar();
            }
            openMiniToolbarEditor = this;
            this._miniToolbarOpen = true;
            if (this.toolbar.parentNode !== document.body) {
                document.body.appendChild(this.toolbar);
            }
            this.toolbar.hidden = false;
            this.toolbar.classList.add('is-open');
            this.toolbar.style.setProperty('z-index', String(RTE_Z_POPUP), 'important');
            this.positionMiniFloatingToolbar();
            requestAnimationFrame(() => this.positionMiniFloatingToolbar());
            if (!this._miniRepositionBound) {
                window.addEventListener('scroll', this._repositionMiniToolbar, true);
                window.addEventListener('resize', this._repositionMiniToolbar);
                this._miniRepositionBound = true;
            }
            if (!this._miniDocPointerBound) {
                document.addEventListener('mousedown', this._onMiniDocPointer, true);
                document.addEventListener('focusin', this._onMiniFocusIn, true);
                this._miniDocPointerBound = true;
            }
        },

        hideMiniFloatingToolbar() {
            if (!this.toolbar || !this._miniToolbarOpen) return;
            this.closeAllToolbarPopups();
            this._miniToolbarOpen = false;
            if (openMiniToolbarEditor === this) {
                openMiniToolbarEditor = null;
            }
            this.toolbar.classList.remove('is-open');
            this.toolbar.hidden = true;
            if (this.editorContainer && this.toolbar.parentNode !== this.editorContainer) {
                this.editorContainer.insertBefore(this.toolbar, this.editorContainer.firstChild);
            }
            if (this._miniRepositionBound) {
                window.removeEventListener('scroll', this._repositionMiniToolbar, true);
                window.removeEventListener('resize', this._repositionMiniToolbar);
                this._miniRepositionBound = false;
            }
            if (this._miniDocPointerBound) {
                document.removeEventListener('mousedown', this._onMiniDocPointer, true);
                document.removeEventListener('focusin', this._onMiniFocusIn, true);
                this._miniDocPointerBound = false;
            }
        },

        positionMiniFloatingToolbar() {
            if (!this.toolbar || !this.richTextEditor || !this._miniToolbarOpen) return;
            const rect = this.richTextEditor.getBoundingClientRect();
            const gap = 6;
            const margin = 8;
            const maxWidth = Math.max(160, window.innerWidth - margin * 2);
            const width = Math.min(Math.max(rect.width, 320), maxWidth);
            this.toolbar.style.position = 'fixed';
            this.toolbar.style.width = width + 'px';
            this.toolbar.style.maxWidth = maxWidth + 'px';
            let left = rect.left;
            if (left + width > window.innerWidth - margin) {
                left = Math.max(margin, window.innerWidth - width - margin);
            }
            if (left < margin) left = margin;
            this.toolbar.style.left = left + 'px';
            const tbH = this.toolbar.offsetHeight || 44;
            let top = rect.top - tbH - gap;
            if (top < margin) {
                top = rect.bottom + gap;
            }
            this.toolbar.style.top = top + 'px';
        },

        teardownMiniFloatingToolbar() {
            this.hideMiniFloatingToolbar();
            if (!this._miniFloatingBound) return;
            if (this.richTextEditor && this._showMiniToolbar) {
                this.richTextEditor.removeEventListener('focus', this._showMiniToolbar);
                this.richTextEditor.removeEventListener('click', this._showMiniToolbar);
            }
            this._miniFloatingBound = false;
        },

        createToolbarButton(action, parent) {
            const target = parent || this.toolbar;
            if (action === 'fontName' || action === 'fontSize' || action === 'foreColor' || action === 'backColor' || action === 'symbols' || action === 'formatBlock' || action === 'insertMenu') {
                this.createToolbarDropdown(action, target);
                return;
            }
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'rte-btn rte-btn-' + action;
            button.setAttribute('data-action', action);
            const buttonConfig = this.getButtonConfig(action);
            button.innerHTML = buttonConfig.icon;
            button.title = buttonConfig.title;
            if (action === 'foreColor') {
                button.style.color = '#000';
                button.style.borderBottom = '3px solid ' + ((this.options.colorDefaults && this.options.colorDefaults.text) || '#000000');
            }
            // Contextual table tools start disabled until updateTableToolbarState runs.
            if (isTableContextAction(action)) {
                button.disabled = true;
            }
            button.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleToolbarAction(action);
            });
            target.appendChild(button);
        },

        fontFamilyCss(value) {
            if (!value) return '';
            const name = String(value).trim();
            if (!name) return '';
            const lower = name.toLowerCase();
            const configured = (this.options.fonts || []).find((f) => f && f.css && String(f.value).toLowerCase() === lower);
            if (configured) return configured.css;
            const quoted = /\s/.test(name) ? ("'" + name.replace(/'/g, "\\'") + "'") : name;
            const serifFonts = ['times new roman', 'times', 'georgia', 'garamond', 'palatino', 'serif'];
            if (serifFonts.indexOf(lower) >= 0) {
                return quoted + ', Times, serif';
            }
            return quoted + ', sans-serif';
        },

        closeAllToolbarPopups(except) {
            if (!this.toolbarDropdowns) return;
            Object.keys(this.toolbarDropdowns).forEach((key) => {
                const handle = this.toolbarDropdowns[key];
                if (!handle || handle === except || typeof handle.close !== 'function') return;
                handle.close();
            });
            const palettes = document.querySelectorAll('.rte-color-palette.is-open');
            palettes.forEach((palette) => {
                if (except && except.menu === palette) return;
                palette.hidden = true;
                palette.classList.remove('is-open');
                palette.style.display = 'none';
            });
        },

        createSmartDropdown(config) {
            const action = config.action;
            const options = config.options || [];
            const title = config.title || action;
            const holdValue = config.holdValue !== false;
            const formatLabel = typeof config.formatLabel === 'function'
                ? config.formatLabel
                : (opt) => (opt && opt.text) || '';
            const decorateItem = typeof config.decorateItem === 'function' ? config.decorateItem : null;
            const decorateButton = typeof config.decorateButton === 'function' ? config.decorateButton : null;

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'rte-btn rte-dropdown-btn rte-dropdown-' + action;
            btn.setAttribute('data-action', action);
            btn.title = title;
            btn.setAttribute('aria-haspopup', 'listbox');
            btn.setAttribute('aria-expanded', 'false');
            btn.setAttribute('aria-label', title);

            const labelEl = document.createElement('span');
            labelEl.className = 'rte-dropdown-label';
            const caret = document.createElement('i');
            caret.className = 'fas fa-caret-down rte-dropdown-caret';
            caret.setAttribute('aria-hidden', 'true');
            btn.appendChild(labelEl);
            btn.appendChild(caret);

            const menu = document.createElement('div');
            menu.className = 'rte-dropdown-menu';
            menu.setAttribute('role', 'listbox');
            menu.setAttribute('aria-label', title);
            menu.hidden = true;

            let currentValue = holdValue && options.length ? options[0].value : '';
            let activeIndex = -1;
            let docCloser = null;
            let keyHandler = null;
            let handle = null;

            const findOption = (value) => {
                for (let i = 0; i < options.length; i++) {
                    if (options[i].value === value) return options[i];
                }
                return null;
            };

            const setLabel = (value) => {
                const opt = findOption(value);
                if (holdValue) {
                    currentValue = opt ? opt.value : (options[0] ? options[0].value : '');
                    const show = opt || options[0] || { text: title, value: '' };
                    labelEl.textContent = formatLabel(show, currentValue);
                    if (decorateButton) decorateButton(btn, labelEl, show);
                } else {
                    labelEl.textContent = formatLabel(null, value);
                    if (decorateButton) decorateButton(btn, labelEl, null);
                }
            };

            const syncSelectedMarkers = () => {
                const items = menu.querySelectorAll('.rte-dropdown-item');
                items.forEach((item) => {
                    const selected = holdValue && item.getAttribute('data-value') === String(currentValue);
                    item.classList.toggle('is-selected', selected);
                    item.setAttribute('aria-selected', selected ? 'true' : 'false');
                });
            };

            const setActiveIndex = (index) => {
                const items = menu.querySelectorAll('.rte-dropdown-item');
                if (!items.length) {
                    activeIndex = -1;
                    return;
                }
                if (index < 0) index = items.length - 1;
                if (index >= items.length) index = 0;
                activeIndex = index;
                items.forEach((item, i) => {
                    item.classList.toggle('is-active', i === activeIndex);
                });
                const active = items[activeIndex];
                if (active && typeof active.scrollIntoView === 'function') {
                    active.scrollIntoView({ block: 'nearest' });
                }
            };

            const close = () => {
                if (menu.hidden) return;
                menu.hidden = true;
                menu.classList.remove('is-open');
                menu.style.display = 'none';
                btn.setAttribute('aria-expanded', 'false');
                menu.querySelectorAll('.rte-dropdown-item.is-active').forEach((el) => {
                    el.classList.remove('is-active');
                });
                activeIndex = -1;
                if (docCloser) {
                    document.removeEventListener('mousedown', docCloser, true);
                    docCloser = null;
                }
                if (keyHandler) {
                    document.removeEventListener('keydown', keyHandler, true);
                    keyHandler = null;
                }
            };

            const pick = (value) => {
                if (holdValue) setLabel(value);
                close();
                if (typeof config.onSelect === 'function') {
                    config.onSelect(value);
                }
            };

            const open = () => {
                this.closeAllToolbarPopups(handle);
                if (menu.parentNode !== document.body) {
                    document.body.appendChild(menu);
                }
                syncSelectedMarkers();
                menu.hidden = false;
                menu.classList.add('is-open');
                menu.style.display = 'block';
                btn.setAttribute('aria-expanded', 'true');

                const rect = btn.getBoundingClientRect();
                const menuWidth = Math.max(rect.width, 160);
                menu.style.minWidth = menuWidth + 'px';
                let left = rect.left;
                if (left + menuWidth > window.innerWidth - 8) {
                    left = Math.max(8, window.innerWidth - menuWidth - 8);
                }
                menu.style.left = left + 'px';
                menu.style.top = (rect.bottom + 6) + 'px';

                let startIndex = 0;
                if (holdValue) {
                    const idx = options.findIndex((o) => o.value === currentValue);
                    startIndex = idx >= 0 ? idx : 0;
                }
                setActiveIndex(startIndex);

                docCloser = (ev) => {
                    if (ev.target === btn || btn.contains(ev.target) || menu.contains(ev.target)) {
                        return;
                    }
                    close();
                };
                document.addEventListener('mousedown', docCloser, true);

                keyHandler = (ev) => {
                    if (menu.hidden) return;
                    if (ev.key === 'Escape') {
                        ev.preventDefault();
                        close();
                        btn.focus();
                        return;
                    }
                    if (ev.key === 'ArrowDown') {
                        ev.preventDefault();
                        setActiveIndex(activeIndex + 1);
                        return;
                    }
                    if (ev.key === 'ArrowUp') {
                        ev.preventDefault();
                        setActiveIndex(activeIndex - 1);
                        return;
                    }
                    if (ev.key === 'Enter' || ev.key === ' ') {
                        const items = menu.querySelectorAll('.rte-dropdown-item');
                        if (activeIndex >= 0 && items[activeIndex]) {
                            ev.preventDefault();
                            pick(items[activeIndex].getAttribute('data-value'));
                        }
                    }
                };
                document.addEventListener('keydown', keyHandler, true);
            };

            options.forEach((opt) => {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'rte-dropdown-item';
                item.setAttribute('role', 'option');
                item.setAttribute('data-value', opt.value);
                item.setAttribute('aria-selected', 'false');

                const text = document.createElement('span');
                text.className = 'rte-dropdown-item-text';
                text.textContent = opt.text;
                item.appendChild(text);

                if (decorateItem) decorateItem(item, opt);

                item.addEventListener('mousedown', (e) => {
                    e.preventDefault();
                });
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    pick(opt.value);
                });
                menu.appendChild(item);
            });

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!menu.hidden && menu.classList.contains('is-open')) {
                    close();
                    return;
                }
                open();
            });

            setLabel(currentValue);

            handle = {
                button: btn,
                menu: menu,
                close: close,
                setValue: (value) => {
                    if (!holdValue) return;
                    setLabel(value);
                    syncSelectedMarkers();
                },
                getValue: () => currentValue
            };
            return handle;
        },

        createToolbarDropdown(action, parent) {
            const target = parent || this.toolbar;
            const wrap = document.createElement('div');
            wrap.className = 'rte-toolbar-dropdown';
            wrap.style.cssText = 'position:relative;display:inline-flex;';

            if (!this.toolbarDropdowns) {
                this.toolbarDropdowns = {};
            }

            if (action === 'fontName') {
                const fonts = this.options.fonts || [];
                const handle = this.createSmartDropdown({
                    action: 'fontName',
                    title: 'Font',
                    options: fonts,
                    formatLabel: (opt) => (opt && opt.text) || 'Font',
                    decorateButton: (btn, labelEl, opt) => {
                        labelEl.style.fontFamily = (opt && opt.value)
                            ? this.fontFamilyCss(opt.value)
                            : '';
                    },
                    decorateItem: (item, opt) => {
                        const css = this.fontFamilyCss(opt.value);
                        item.style.setProperty('font-family', css, 'important');
                        const text = item.querySelector('.rte-dropdown-item-text');
                        if (text) text.style.setProperty('font-family', css, 'important');
                    },
                    onSelect: (value) => {
                        this.restoreSavedSelection();
                        if (value) {
                            this.applyInlineStyle('font-family', this.fontFamilyCss(value));
                        }
                        this.notifyChange();
                    }
                });
                this.toolbarDropdowns.fontName = handle;
                wrap.appendChild(handle.button);
            } else if (action === 'fontSize') {
                const sizes = this.options.fontSizes || [];
                const handle = this.createSmartDropdown({
                    action: 'fontSize',
                    title: 'Font Size',
                    options: sizes,
                    formatLabel: (opt) => {
                        if (!opt || !opt.value) return 'Size';
                        return opt.text;
                    },
                    onSelect: (value) => {
                        this.restoreSavedSelection();
                        if (!value) {
                            document.execCommand('removeFormat', false, null);
                        } else {
                            this.applyInlineStyle('font-size', value);
                        }
                        this.notifyChange();
                    }
                });
                this.toolbarDropdowns.fontSize = handle;
                wrap.appendChild(handle.button);
            } else if (action === 'foreColor' || action === 'backColor') {
                const isHighlight = action === 'backColor';
                const colorDefaults = this.options.colorDefaults || {};
                const defaultColor = (isHighlight ? colorDefaults.highlight : colorDefaults.text)
                    || (isHighlight ? '#FFF200' : '#000000');
                const hexId = 'rte-' + action.toLowerCase() + '-hex';
                const paletteColors = this.options.colors || [];

                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'rte-btn rte-btn-' + action;
                btn.title = isHighlight ? 'Highlight' : 'Text Color';
                btn.innerHTML = isHighlight
                    ? '<span class="rte-color-indicator" style="display:inline-block;line-height:1;padding-bottom:1px;border-bottom:3px solid ' + defaultColor + '"><i class="fas fa-highlighter" aria-hidden="true"></i></span>'
                    : '<strong class="rte-color-indicator" style="border-bottom:3px solid ' + defaultColor + '">A</strong>';

                const palette = document.createElement('div');
                palette.className = 'rte-color-palette';
                palette.setAttribute('role', 'dialog');
                palette.setAttribute('aria-label', isHighlight ? 'Highlight color' : 'Text color');
                palette.hidden = true;

                const SWATCH = 28;
                const COLS = 8;
                const GAP = 6;
                const PAD = 10;
                const panelWidth = PAD * 2 + COLS * SWATCH + (COLS - 1) * GAP;

                const swatchGrid = document.createElement('div');
                swatchGrid.className = 'rte-color-swatch-grid';

                const hexRow = document.createElement('div');
                hexRow.className = 'rte-color-hex-row';

                const hexLabel = document.createElement('label');
                hexLabel.textContent = 'Hex';
                hexLabel.htmlFor = hexId;
                hexLabel.style.cssText = 'font-size:12px;font-weight:600;color:#495057;margin:0;white-space:nowrap;';

                const hexInput = document.createElement('input');
                hexInput.type = 'text';
                hexInput.id = hexId;
                hexInput.placeholder = defaultColor;
                hexInput.spellcheck = false;
                hexInput.autocomplete = 'off';
                hexInput.maxLength = 7;

                const hexNative = document.createElement('input');
                hexNative.type = 'color';
                hexNative.title = 'Pick color';
                hexNative.value = defaultColor;

                const hexApply = document.createElement('button');
                hexApply.type = 'button';
                hexApply.textContent = 'Apply';
                hexApply.className = 'rte-color-hex-apply';

                const normalizeHex = (raw) => {
                    if (!raw) return null;
                    let v = String(raw).trim();
                    if (!v) return null;
                    if (v.charAt(0) !== '#') v = '#' + v;
                    if (/^#[0-9a-fA-F]{3}$/.test(v)) {
                        v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
                    }
                    if (!/^#[0-9a-fA-F]{6}$/.test(v)) return null;
                    return v.toUpperCase();
                };

                const execColor = (value) => {
                    if (!isHighlight) {
                        document.execCommand('foreColor', false, value);
                        return;
                    }
                    // Firefox only applies hiliteColor in CSS mode; reset so other commands keep their default output.
                    document.execCommand('styleWithCSS', false, true);
                    if (!document.execCommand('hiliteColor', false, value)) {
                        document.execCommand('backColor', false, value);
                    }
                    document.execCommand('styleWithCSS', false, false);
                };

                const applyColor = (color) => {
                    const hex = normalizeHex(color);
                    if (!hex) return false;
                    this.restoreSavedSelection();
                    execColor(hex);
                    const indicator = btn.querySelector('.rte-color-indicator');
                    if (indicator) indicator.style.borderBottomColor = hex;
                    hexInput.value = hex;
                    hexNative.value = hex;
                    closePalette();
                    this.notifyChange();
                    return true;
                };

                const removeHighlight = () => {
                    this.restoreSavedSelection();
                    execColor('transparent');
                    closePalette();
                    this.notifyChange();
                };

                const applyPaletteChrome = () => {
                    palette.style.cssText = [
                        'position:fixed',
                        'z-index:' + RTE_Z_POPUP,
                        'display:flex',
                        'flex-direction:column',
                        'gap:10px',
                        'padding:' + PAD + 'px',
                        'box-sizing:border-box',
                        'width:' + panelWidth + 'px',
                        'background:#ffffff',
                        'border:1px solid #ced4da',
                        'border-radius:8px',
                        'box-shadow:0 8px 24px rgba(0,0,0,0.18)',
                    ].join(';');

                    swatchGrid.style.cssText = [
                        'display:grid',
                        'grid-template-columns:repeat(' + COLS + ', ' + SWATCH + 'px)',
                        'grid-auto-rows:' + SWATCH + 'px',
                        'gap:' + GAP + 'px',
                        'width:100%',
                        'box-sizing:border-box',
                    ].join(';');

                    hexRow.style.cssText = [
                        'display:flex',
                        'align-items:center',
                        'gap:6px',
                        'width:100%',
                        'box-sizing:border-box',
                        'border-top:1px solid #e9ecef',
                        'padding-top:10px',
                    ].join(';');

                    hexInput.style.cssText = [
                        'flex:1 1 auto',
                        'min-width:0',
                        'height:30px',
                        'padding:4px 8px',
                        'border:1px solid #ced4da',
                        'border-radius:4px',
                        'font-size:12px',
                        'font-family:Consolas,Monaco,monospace',
                        'box-sizing:border-box',
                    ].join(';');

                    hexNative.style.cssText = [
                        'width:30px',
                        'height:30px',
                        'padding:0',
                        'border:1px solid #ced4da',
                        'border-radius:4px',
                        'background:#fff',
                        'cursor:pointer',
                        'box-sizing:border-box',
                    ].join(';');

                    hexApply.style.cssText = [
                        'height:30px',
                        'padding:0 10px',
                        'border:1px solid var(--rte-accent)',
                        'border-radius:4px',
                        'background:var(--rte-accent)',
                        'color:#fff',
                        'font-size:12px',
                        'font-weight:600',
                        'cursor:pointer',
                        'flex:0 0 auto',
                        'box-sizing:border-box',
                    ].join(';');
                };

                const closePalette = () => {
                    palette.hidden = true;
                    palette.classList.remove('is-open');
                    palette.style.display = 'none';
                };

                const openPalette = () => {
                    this.closeAllToolbarPopups({ menu: palette });
                    if (palette.parentNode !== document.body) {
                        document.body.appendChild(palette);
                    }
                    applyPaletteChrome();
                    const rect = btn.getBoundingClientRect();
                    let left = rect.left;
                    if (left + panelWidth > window.innerWidth - 8) {
                        left = Math.max(8, window.innerWidth - panelWidth - 8);
                    }
                    palette.style.left = left + 'px';
                    palette.style.top = (rect.bottom + 6) + 'px';
                    palette.hidden = false;
                    palette.classList.add('is-open');
                    setTimeout(() => hexInput.focus(), 0);
                };

                paletteColors.forEach((c) => {
                    const swatch = document.createElement('button');
                    swatch.type = 'button';
                    swatch.className = 'rte-color-swatch';
                    swatch.title = c;
                    swatch.setAttribute('aria-label', c);
                    swatch.style.cssText = [
                        'width:' + SWATCH + 'px',
                        'height:' + SWATCH + 'px',
                        'min-width:' + SWATCH + 'px',
                        'min-height:' + SWATCH + 'px',
                        'padding:0',
                        'margin:0',
                        'border:1px solid #adb5bd',
                        'border-radius:4px',
                        'background:' + c,
                        'cursor:pointer',
                        'box-sizing:border-box',
                        'flex:none',
                        'display:block',
                    ].join(';');
                    swatch.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        applyColor(c);
                    });
                    swatchGrid.appendChild(swatch);
                });

                hexApply.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!applyColor(hexInput.value)) {
                        hexInput.style.borderColor = '#dc3545';
                        hexInput.focus();
                    }
                });
                hexInput.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        e.stopPropagation();
                        if (!applyColor(hexInput.value)) {
                            hexInput.style.borderColor = '#dc3545';
                        }
                    }
                });
                hexInput.addEventListener('input', () => {
                    hexInput.style.borderColor = '#ced4da';
                    const hex = normalizeHex(hexInput.value);
                    if (hex) hexNative.value = hex;
                });
                hexNative.addEventListener('input', () => {
                    hexInput.value = hexNative.value.toUpperCase();
                    hexInput.style.borderColor = '#ced4da';
                });
                hexNative.addEventListener('change', () => {
                    applyColor(hexNative.value);
                });

                hexRow.appendChild(hexLabel);
                hexRow.appendChild(hexInput);
                hexRow.appendChild(hexNative);
                hexRow.appendChild(hexApply);

                if (isHighlight) {
                    const noneBtn = document.createElement('button');
                    noneBtn.type = 'button';
                    noneBtn.className = 'rte-color-none';
                    noneBtn.innerHTML = '<i class="fas fa-ban" aria-hidden="true"></i> No highlight';
                    noneBtn.style.cssText = [
                        'display:flex',
                        'align-items:center',
                        'justify-content:center',
                        'gap:6px',
                        'width:100%',
                        'height:30px',
                        'padding:0 10px',
                        'border:1px solid #ced4da',
                        'border-radius:4px',
                        'background:#fff',
                        'color:#495057',
                        'font-size:12px',
                        'font-weight:600',
                        'cursor:pointer',
                        'box-sizing:border-box',
                    ].join(';');
                    noneBtn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        removeHighlight();
                    });
                    palette.appendChild(noneBtn);
                }
                palette.appendChild(swatchGrid);
                palette.appendChild(hexRow);

                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (palette.classList.contains('is-open') && !palette.hidden) {
                        closePalette();
                        return;
                    }
                    openPalette();
                    const onDoc = (ev) => {
                        if (ev.target === btn || btn.contains(ev.target) || palette.contains(ev.target)) {
                            return;
                        }
                        closePalette();
                        document.removeEventListener('mousedown', onDoc, true);
                    };
                    document.addEventListener('mousedown', onDoc, true);
                });

                this.toolbarDropdowns[action] = { close: closePalette, menu: palette };
                wrap.appendChild(btn);
            } else if (action === 'formatBlock') {
                const formats = this.options.blockFormats || [];
                const headingSizes = {
                    h1: '1.5em',
                    h2: '1.3em',
                    h3: '1.15em',
                    h4: '1.05em',
                    h5: '1em',
                    h6: '0.95em',
                    pre: '0.9em'
                };
                const handle = this.createSmartDropdown({
                    action: 'formatBlock',
                    title: 'Text Formatting',
                    options: formats,
                    formatLabel: (opt) => (opt && opt.text) || 'Paragraph',
                    decorateItem: (item, opt) => {
                        const size = headingSizes[opt.value];
                        if (size) item.style.fontSize = size;
                        if (opt.value === 'pre') item.style.fontFamily = 'Consolas, Monaco, monospace';
                        if (/^h[1-6]$/.test(opt.value)) item.style.fontWeight = '700';
                    },
                    onSelect: (value) => {
                        this.restoreSavedSelection();
                        if (value) {
                            document.execCommand('formatBlock', false, '<' + value + '>');
                        }
                        this.notifyChange();
                        this.updateActiveStates();
                    }
                });
                this.toolbarDropdowns.formatBlock = handle;
                wrap.appendChild(handle.button);
            } else if (action === 'symbols') {
                this.createSymbolPicker(wrap);
            } else if (action === 'insertMenu') {
                this.createInsertMenu(wrap);
                if (!wrap.childNodes.length) return;
            }

            target.appendChild(wrap);
        },

        createSymbolPicker(wrap) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'rte-btn rte-btn-symbols';
            btn.setAttribute('data-action', 'symbols');
            btn.title = 'Symbols';
            btn.setAttribute('aria-haspopup', 'dialog');
            btn.setAttribute('aria-expanded', 'false');
            btn.setAttribute('aria-label', 'Symbols');
            btn.textContent = 'Ω';

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const handle = this.getSymbolPicker();
                if (handle.isOpen() && handle.getAnchor() === btn) {
                    handle.close();
                    return;
                }
                handle.open(btn);
            });

            wrap.appendChild(btn);
        },

        /** Shared symbol picker panel (built once per editor); open(anchor) positions it below any button. */
        getSymbolPicker() {
            if (this._symbolPicker) return this._symbolPicker;
            if (!this.toolbarDropdowns) {
                this.toolbarDropdowns = {};
            }
            const symbols = (this.options.symbols || []).filter((s) => s && s.value);
            const columns = Math.max(1, parseInt(this.options.symbolColumns, 10) || 10);
            const CELL = 30;
            const GAP = 4;
            const PAD = 10;
            const SCROLLBAR = 18;
            const panelWidth = PAD * 2 + columns * CELL + (columns - 1) * GAP + SCROLLBAR;

            const decoder = document.createElement('textarea');
            const glyphOf = (s) => {
                if (s.symbol) return s.symbol;
                decoder.innerHTML = s.value;
                return decoder.value;
            };
            // Legacy entries were labelled '® Registered Mark'; drop the leading glyph.
            const nameOf = (s, glyph) => {
                const text = String(s.text || '').trim();
                if (glyph && text.indexOf(glyph) === 0) return text.slice(glyph.length).trim() || text;
                return text;
            };

            let anchor = null;

            const picker = document.createElement('div');
            picker.className = 'rte-symbol-picker';
            picker.setAttribute('role', 'dialog');
            picker.setAttribute('aria-label', 'Insert symbol');
            picker.hidden = true;
            picker.style.setProperty('--rte-symbol-cols', String(columns));

            const body = document.createElement('div');
            body.className = 'rte-symbol-body';

            const preview = document.createElement('div');
            preview.className = 'rte-symbol-preview';
            preview.setAttribute('aria-live', 'polite');

            const cells = [];
            const categories = [];
            const byCategory = {};
            symbols.forEach((s) => {
                const category = s.category || 'Other';
                if (!byCategory[category]) {
                    byCategory[category] = [];
                    categories.push(category);
                }
                byCategory[category].push(s);
            });

            let activeIndex = -1;
            let docCloser = null;
            let keyHandler = null;

            const showPreview = (cell) => {
                preview.textContent = cell
                    ? cell.getAttribute('data-glyph') + '  ' + cell.getAttribute('data-name')
                    : '';
            };

            const setActive = (index) => {
                if (!cells.length) return;
                if (index < 0) index = 0;
                if (index >= cells.length) index = cells.length - 1;
                if (cells[activeIndex]) cells[activeIndex].classList.remove('is-active');
                activeIndex = index;
                const cell = cells[activeIndex];
                cell.classList.add('is-active');
                if (typeof cell.scrollIntoView === 'function') cell.scrollIntoView({ block: 'nearest' });
                showPreview(cell);
            };

            const close = () => {
                if (picker.hidden) return;
                picker.hidden = true;
                picker.classList.remove('is-open');
                picker.style.display = 'none';
                if (anchor) anchor.setAttribute('aria-expanded', 'false');
                if (cells[activeIndex]) cells[activeIndex].classList.remove('is-active');
                activeIndex = -1;
                if (docCloser) {
                    document.removeEventListener('mousedown', docCloser, true);
                    docCloser = null;
                }
                if (keyHandler) {
                    document.removeEventListener('keydown', keyHandler, true);
                    keyHandler = null;
                }
            };

            const insert = (value) => {
                close();
                this.restoreSavedSelection();
                document.execCommand('insertHTML', false, value);
                this.notifyChange();
            };

            // Arrow keys move by cell within a category grid; up/down jump rows and cross categories.
            const moveVertical = (delta) => {
                const cell = cells[activeIndex];
                if (!cell) return setActive(0);
                const grid = cell.parentNode;
                const inGrid = Array.prototype.indexOf.call(grid.children, cell);
                const col = inGrid % columns;
                const target = inGrid + delta * columns;
                if (target >= 0 && target < grid.children.length) {
                    return setActive(cells.indexOf(grid.children[target]));
                }
                const grids = Array.prototype.slice.call(body.querySelectorAll('.rte-symbol-grid'));
                const next = grids[grids.indexOf(grid) + delta];
                if (!next) return;
                const count = next.children.length;
                let idx;
                if (delta > 0) {
                    idx = Math.min(col, count - 1);
                } else {
                    const lastRowStart = Math.floor((count - 1) / columns) * columns;
                    idx = Math.min(lastRowStart + col, count - 1);
                }
                setActive(cells.indexOf(next.children[idx]));
            };

            const open = (anchorEl) => {
                this.closeAllToolbarPopups({ menu: picker });
                close();
                anchor = anchorEl;
                if (picker.parentNode !== document.body) {
                    document.body.appendChild(picker);
                }
                picker.hidden = false;
                picker.classList.add('is-open');
                picker.style.display = 'flex';
                picker.style.zIndex = String(RTE_Z_POPUP);
                picker.style.width = panelWidth + 'px';
                anchor.setAttribute('aria-expanded', 'true');

                const rect = anchor.getBoundingClientRect();
                let left = rect.left;
                if (left + panelWidth > window.innerWidth - 8) {
                    left = Math.max(8, window.innerWidth - panelWidth - 8);
                }
                let top = rect.bottom + 6;
                const height = picker.offsetHeight;
                if (top + height > window.innerHeight - 8 && rect.top - height - 6 >= 8) {
                    top = rect.top - height - 6;
                }
                picker.style.left = left + 'px';
                picker.style.top = top + 'px';
                setActive(0);

                docCloser = (ev) => {
                    if (anchor && (ev.target === anchor || anchor.contains(ev.target))) return;
                    if (picker.contains(ev.target)) return;
                    close();
                };
                document.addEventListener('mousedown', docCloser, true);

                keyHandler = (ev) => {
                    if (picker.hidden) return;
                    if (ev.key === 'Escape') {
                        ev.preventDefault();
                        const focusTarget = anchor;
                        close();
                        if (focusTarget) focusTarget.focus();
                    } else if (ev.key === 'ArrowRight') {
                        ev.preventDefault();
                        setActive(activeIndex + 1);
                    } else if (ev.key === 'ArrowLeft') {
                        ev.preventDefault();
                        setActive(activeIndex - 1);
                    } else if (ev.key === 'ArrowDown') {
                        ev.preventDefault();
                        moveVertical(1);
                    } else if (ev.key === 'ArrowUp') {
                        ev.preventDefault();
                        moveVertical(-1);
                    } else if (ev.key === 'Enter' || ev.key === ' ') {
                        const cell = cells[activeIndex];
                        if (cell) {
                            ev.preventDefault();
                            insert(cell.getAttribute('data-value'));
                        }
                    }
                };
                document.addEventListener('keydown', keyHandler, true);
            };

            categories.forEach((category) => {
                const header = document.createElement('div');
                header.className = 'rte-symbol-category';
                header.textContent = category;
                body.appendChild(header);

                const grid = document.createElement('div');
                grid.className = 'rte-symbol-grid';
                grid.setAttribute('role', 'grid');
                grid.setAttribute('aria-label', category);

                byCategory[category].forEach((s) => {
                    const glyph = glyphOf(s);
                    const name = nameOf(s, glyph);
                    const cell = document.createElement('button');
                    cell.type = 'button';
                    cell.className = 'rte-symbol-cell';
                    cell.textContent = glyph;
                    cell.title = name;
                    cell.setAttribute('aria-label', name);
                    cell.setAttribute('data-value', s.value);
                    cell.setAttribute('data-glyph', glyph);
                    cell.setAttribute('data-name', name);
                    cell.addEventListener('mousedown', (e) => e.preventDefault());
                    cell.addEventListener('mouseenter', () => setActive(cells.indexOf(cell)));
                    cell.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        insert(s.value);
                    });
                    cells.push(cell);
                    grid.appendChild(cell);
                });
                body.appendChild(grid);
            });

            picker.appendChild(body);
            picker.appendChild(preview);

            this._symbolPicker = {
                picker,
                open,
                close,
                isOpen: () => !picker.hidden && picker.classList.contains('is-open'),
                getAnchor: () => anchor
            };
            this.toolbarDropdowns.symbols = { close, menu: picker };
            return this._symbolPicker;
        },

        getButtonConfig(action) {
            const fa = (name) => '<i class="fas fa-' + name + '" aria-hidden="true"></i>';
            // Original action glyph + a small muted table hint so the group reads as table tools.
            const tableAction = (name) =>
                '<span class="rte-table-action">' +
                fa(name) +
                '<i class="fas fa-table rte-table-hint" aria-hidden="true"></i>' +
                '</span>';
            const configs = {
                bold: { icon: fa('bold'), title: 'Bold' },
                italic: { icon: fa('italic'), title: 'Italic' },
                underline: { icon: fa('underline'), title: 'Underline' },
                strike: { icon: fa('strikethrough'), title: 'Strikethrough' },
                h1: { icon: 'H1', title: 'Heading 1' },
                h2: { icon: 'H2', title: 'Heading 2' },
                h3: { icon: 'H3', title: 'Heading 3' },
                h4: { icon: 'H4', title: 'Heading 4' },
                h5: { icon: 'H5', title: 'Heading 5' },
                h6: { icon: 'H6', title: 'Heading 6' },
                left: { icon: fa('align-left'), title: 'Align Left' },
                center: { icon: fa('align-center'), title: 'Align Center' },
                right: { icon: fa('align-right'), title: 'Align Right' },
                justify: { icon: fa('align-justify'), title: 'Justify' },
                bullet: { icon: fa('list-ul'), title: 'Bullet List' },
                number: { icon: fa('list-ol'), title: 'Numbered List' },
                link: { icon: fa('link'), title: 'Insert Link' },
                image: { icon: fa('image'), title: 'Insert Image' },
                video: { icon: fa('video'), title: 'Embed Video' },
                table: { icon: fa('table'), title: 'Insert Table' },
                tableRowAbove: { icon: tableAction('arrow-up'), title: 'Add Row Above' },
                tableRowBelow: { icon: tableAction('arrow-down'), title: 'Add Row Below' },
                tableColLeft: { icon: tableAction('arrow-left'), title: 'Add Column Left' },
                tableColRight: { icon: tableAction('arrow-right'), title: 'Add Column Right' },
                tableDeleteRow: { icon: tableAction('minus-square'), title: 'Delete Row' },
                tableDeleteCol: { icon: tableAction('columns'), title: 'Delete Column' },
                tableMergeRight: { icon: tableAction('arrow-right'), title: 'Merge Cell Right' },
                tableMergeDown: { icon: tableAction('arrow-down'), title: 'Merge Cell Down' },
                tableSplitCell: { icon: tableAction('expand'), title: 'Split Cell' },
                tableCellProperties: { icon: tableAction('cog'), title: 'Cell Properties' },
                undo: { icon: fa('undo'), title: 'Undo' },
                redo: { icon: fa('redo'), title: 'Redo' },
                find: { icon: fa('search'), title: 'Find (Ctrl+F)' },
                findReplace: { icon: fa('exchange-alt'), title: 'Find and Replace (Ctrl+H)' },
                source: { icon: fa('code'), title: 'HTML Source Mode' },
                preview: { icon: fa('eye'), title: 'Preview' },
                expand: { icon: fa('expand'), title: 'Expand editor' },
                templates: { icon: fa('file-alt') + '<span class="rte-btn-label">Templates</span>', title: 'Insert Template' },
                insertMenu: { icon: fa('plus'), title: 'Insert' },
                subscript: { icon: 'X<sub>2</sub>', title: 'Subscript' },
                superscript: { icon: 'X<sup>2</sup>', title: 'Superscript' },
                clearFormatting: { icon: fa('eraser'), title: 'Remove Formatting' },
                hr: { icon: fa('minus'), title: 'Horizontal Rule' },
                hiddenSep: { icon: fa('grip-lines'), title: 'Hidden separator' },
                uppercase: { icon: 'ABC', title: 'All Caps' },
                fontName: { icon: 'Font', title: 'Font' },
                fontSize: { icon: 'Size', title: 'Font Size' },
                formatBlock: { icon: 'Format', title: 'Text Formatting' },
                foreColor: { icon: 'A', title: 'Text Color' },
                backColor: { icon: fa('highlighter'), title: 'Highlight' },
                symbols: { icon: 'Ω', title: 'Symbols' }
            };
            return configs[action] || { icon: action, title: action };
        }
    
        /**
         * Remove empty Figma clipboard artifact spans (data-buffer with encoded figma payload).
         * @param {string} html
         * @returns {string}
         */
  } as any
);
