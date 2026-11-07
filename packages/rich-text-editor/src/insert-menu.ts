// @ts-nocheck
/**
 * RichTextEditor mixin — insert-menu.ts
 * Insert (+) toolbar dropdown: HTML elements, templates, table and symbols.
 */
import { RichTextEditorCore } from './core';
import { decorateEditorBlocks } from './template-blocks';

const INSERTABLE_TAG = /^(p|h[1-6]|pre|blockquote|div)$/;
const BLOCK_TAGS = ['P', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'PRE', 'BLOCKQUOTE', 'DIV'];
const HEADING_SIZES = {
    h1: '1.5em',
    h2: '1.3em',
    h3: '1.15em',
    h4: '1.05em',
    h5: '1em',
    h6: '0.95em',
    pre: '0.9em'
};

const fa = (name) => '<i class="fas fa-' + name + '" aria-hidden="true"></i>';

Object.assign(
  RichTextEditorCore.prototype,
  {
        /** Menu entries allowed for this editor, in configured order. */
        getInsertMenuItems() {
            const keys = Array.isArray(this.options.insertMenu) ? this.options.insertMenu : [];
            const toolbar = this.options.toolbar || [];
            const blockFormats = (this.options.blockFormats || []).filter((f) => f && INSERTABLE_TAG.test(f.value));
            const items = [];
            keys.forEach((key) => {
                switch (key) {
                    case 'html':
                        if (!blockFormats.length) return;
                        items.push({ key, text: 'HTML Elements', icon: fa('paragraph'), children: blockFormats });
                        break;
                    case 'templates':
                        if (toolbar.indexOf('templates') < 0) return;
                        items.push({ key, text: 'Templates', icon: fa('file-alt'), run: () => this.handleToolbarAction('templates') });
                        break;
                    case 'table':
                        items.push({ key, text: 'Table', icon: fa('table'), run: () => this.handleToolbarAction('table') });
                        break;
                    case 'symbols':
                        items.push({ key, text: 'Symbol', icon: '<span class="rte-insert-glyph" aria-hidden="true">Ω</span>', opensPopup: true });
                        break;
                }
            });
            return items;
        },

        createInsertMenu(wrap) {
            const items = this.getInsertMenuItems();
            if (!items.length) return;

            const config = this.getButtonConfig('insertMenu');
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'rte-btn rte-btn-insertMenu';
            btn.setAttribute('data-action', 'insertMenu');
            btn.title = config.title;
            btn.setAttribute('aria-label', config.title);
            btn.setAttribute('aria-haspopup', 'menu');
            btn.setAttribute('aria-expanded', 'false');
            btn.innerHTML = config.icon;

            const createMenuEl = (label, extraClass) => {
                const el = document.createElement('div');
                el.className = 'rte-dropdown-menu rte-insert-menu' + (extraClass ? ' ' + extraClass : '');
                el.setAttribute('role', 'menu');
                el.setAttribute('aria-label', label);
                el.hidden = true;
                return el;
            };

            const menu = createMenuEl('Insert');
            const flyouts = [];
            // levels[0] = root menu, levels[1] = open flyout (if any)
            const levels = [{ menu, active: -1 }];
            let docCloser = null;
            let keyHandler = null;
            let handle = null;

            const menuItems = (el) => Array.prototype.slice.call(el.querySelectorAll(':scope > .rte-dropdown-item'));

            const setActive = (level, index) => {
                const entry = levels[level];
                if (!entry) return;
                const list = menuItems(entry.menu);
                if (!list.length) return;
                if (index < 0) index = list.length - 1;
                if (index >= list.length) index = 0;
                entry.active = index;
                list.forEach((el, i) => el.classList.toggle('is-active', i === index));
                if (typeof list[index].scrollIntoView === 'function') list[index].scrollIntoView({ block: 'nearest' });
            };

            const showMenu = (el) => {
                if (el.parentNode !== document.body) document.body.appendChild(el);
                el.hidden = false;
                el.classList.add('is-open');
                el.style.display = 'block';
            };

            const hideMenu = (el) => {
                el.hidden = true;
                el.classList.remove('is-open');
                el.style.display = 'none';
                el.querySelectorAll('.rte-dropdown-item.is-active').forEach((i) => i.classList.remove('is-active'));
            };

            const closeFlyout = () => {
                if (levels.length < 2) return;
                const entry = levels.pop();
                hideMenu(entry.menu);
                if (entry.owner) entry.owner.setAttribute('aria-expanded', 'false');
            };

            const openFlyout = (ownerItem, flyout, focusFirst) => {
                if (levels[1] && levels[1].menu === flyout) {
                    if (focusFirst) setActive(1, 0);
                    return;
                }
                closeFlyout();
                showMenu(flyout);
                const rect = ownerItem.getBoundingClientRect();
                const menuRect = menu.getBoundingClientRect();
                const width = flyout.offsetWidth || 180;
                let left = menuRect.right + 2;
                if (left + width > window.innerWidth - 8) {
                    left = Math.max(8, menuRect.left - width - 2);
                }
                let top = rect.top - 6;
                const height = flyout.offsetHeight;
                if (top + height > window.innerHeight - 8) {
                    top = Math.max(8, window.innerHeight - height - 8);
                }
                flyout.style.left = left + 'px';
                flyout.style.top = top + 'px';
                ownerItem.setAttribute('aria-expanded', 'true');
                levels.push({ menu: flyout, active: -1, owner: ownerItem });
                if (focusFirst) setActive(1, 0);
            };

            const close = () => {
                if (menu.hidden) return;
                closeFlyout();
                hideMenu(menu);
                levels[0].active = -1;
                btn.setAttribute('aria-expanded', 'false');
                if (docCloser) {
                    document.removeEventListener('mousedown', docCloser, true);
                    docCloser = null;
                }
                if (keyHandler) {
                    document.removeEventListener('keydown', keyHandler, true);
                    keyHandler = null;
                }
            };

            const runItem = (item) => {
                if (item.disabled) return;
                close();
                if (item.key === 'symbols') {
                    if (this.currentMode === 'source') return;
                    this.getSymbolPicker().open(btn);
                    return;
                }
                if (typeof item.run === 'function') item.run();
            };

            const pickFormat = (tag) => {
                close();
                this.insertBlockAfter(tag);
            };

            const createItem = (text, iconHtml) => {
                const el = document.createElement('button');
                el.type = 'button';
                el.className = 'rte-dropdown-item rte-insert-item';
                el.setAttribute('role', 'menuitem');
                if (iconHtml) {
                    const icon = document.createElement('span');
                    icon.className = 'rte-insert-icon';
                    icon.innerHTML = iconHtml;
                    el.appendChild(icon);
                }
                const label = document.createElement('span');
                label.className = 'rte-dropdown-item-text';
                label.textContent = text;
                el.appendChild(label);
                el.addEventListener('mousedown', (e) => e.preventDefault());
                return el;
            };

            items.forEach((item) => {
                const el = createItem(item.text, item.icon);
                el.setAttribute('data-insert', item.key);

                if (item.disabled) {
                    el.classList.add('is-disabled');
                    el.setAttribute('aria-disabled', 'true');
                    if (item.hint) {
                        const hint = document.createElement('span');
                        hint.className = 'rte-insert-hint';
                        hint.textContent = item.hint;
                        el.appendChild(hint);
                    }
                }

                if (item.children) {
                    const caret = document.createElement('i');
                    caret.className = 'fas fa-caret-right rte-insert-caret';
                    caret.setAttribute('aria-hidden', 'true');
                    el.appendChild(caret);
                    el.setAttribute('aria-haspopup', 'menu');
                    el.setAttribute('aria-expanded', 'false');

                    const flyout = createMenuEl(item.text, 'rte-insert-flyout');
                    item.children.forEach((opt) => {
                        const child = createItem(opt.text, '');
                        child.setAttribute('data-value', opt.value);
                        const size = HEADING_SIZES[opt.value];
                        if (size) child.style.fontSize = size;
                        if (opt.value === 'pre') child.style.fontFamily = 'Consolas, Monaco, monospace';
                        if (/^h[1-6]$/.test(opt.value)) child.style.fontWeight = '700';
                        child.addEventListener('mouseenter', () => setActive(1, menuItems(flyout).indexOf(child)));
                        child.addEventListener('click', (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            pickFormat(opt.value);
                        });
                        flyout.appendChild(child);
                    });
                    flyouts.push(flyout);
                    item.flyout = flyout;

                    el.addEventListener('mouseenter', () => {
                        setActive(0, menuItems(menu).indexOf(el));
                        openFlyout(el, flyout, false);
                    });
                    el.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        openFlyout(el, flyout, true);
                    });
                } else {
                    el.addEventListener('mouseenter', () => {
                        setActive(0, menuItems(menu).indexOf(el));
                        closeFlyout();
                    });
                    el.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        runItem(item);
                    });
                }
                menu.appendChild(el);
            });

            const activeItem = (level) => {
                const entry = levels[level];
                if (!entry || entry.active < 0) return null;
                return menuItems(entry.menu)[entry.active] || null;
            };

            const open = () => {
                this.closeAllToolbarPopups(handle);
                showMenu(menu);
                btn.setAttribute('aria-expanded', 'true');

                const rect = btn.getBoundingClientRect();
                const width = Math.max(menu.offsetWidth, 200);
                menu.style.minWidth = '200px';
                let left = rect.left;
                if (left + width > window.innerWidth - 8) {
                    left = Math.max(8, window.innerWidth - width - 8);
                }
                menu.style.left = left + 'px';
                menu.style.top = (rect.bottom + 6) + 'px';
                setActive(0, 0);

                docCloser = (ev) => {
                    const t = ev.target;
                    if (t === btn || btn.contains(t) || menu.contains(t)) return;
                    if (flyouts.some((f) => f.contains(t))) return;
                    close();
                };
                document.addEventListener('mousedown', docCloser, true);

                keyHandler = (ev) => {
                    if (menu.hidden) return;
                    const level = levels.length - 1;
                    if (ev.key === 'Escape') {
                        ev.preventDefault();
                        if (level > 0) {
                            closeFlyout();
                        } else {
                            close();
                            btn.focus();
                        }
                    } else if (ev.key === 'ArrowDown') {
                        ev.preventDefault();
                        setActive(level, levels[level].active + 1);
                    } else if (ev.key === 'ArrowUp') {
                        ev.preventDefault();
                        setActive(level, levels[level].active - 1);
                    } else if (ev.key === 'ArrowLeft') {
                        if (level > 0) {
                            ev.preventDefault();
                            closeFlyout();
                        }
                    } else if (ev.key === 'ArrowRight' || ev.key === 'Enter' || ev.key === ' ') {
                        const el = activeItem(level);
                        if (!el) return;
                        if (level > 0) {
                            if (ev.key === 'ArrowRight') return;
                            ev.preventDefault();
                            pickFormat(el.getAttribute('data-value'));
                            return;
                        }
                        const item = items[menuItems(menu).indexOf(el)];
                        if (!item) return;
                        if (item.flyout) {
                            ev.preventDefault();
                            openFlyout(el, item.flyout, true);
                        } else if (ev.key !== 'ArrowRight') {
                            ev.preventDefault();
                            runItem(item);
                        }
                    }
                };
                document.addEventListener('keydown', keyHandler, true);
            };

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!menu.hidden && menu.classList.contains('is-open')) {
                    close();
                    return;
                }
                open();
            });

            handle = { button: btn, menu, close };
            this.toolbarDropdowns.insertMenu = handle;
            wrap.appendChild(btn);
        },

        /** Insert an empty `<tag>` after the block holding the caret and move the caret into it. */
        insertBlockAfter(tag) {
            const editor = this.richTextEditor;
            if (!editor || this.currentMode === 'source' || !INSERTABLE_TAG.test(String(tag || ''))) return;

            this.restoreSavedSelection();
            this.ensureCaretInThisEditor();
            this.savedSelectionRange = null;
            this.flushRichHistoryImmediate();

            const sel = window.getSelection();
            let node = null;
            if (sel && sel.rangeCount) {
                node = sel.getRangeAt(0).endContainer;
                if (node && !editor.contains(node)) node = null;
            }

            let parent = editor;
            let reference = null;
            let current = node && node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
            let block = null;
            while (current && current !== editor) {
                const name = current.nodeName;
                if (name === 'TD' || name === 'TH') {
                    parent = current;
                    break;
                }
                if (name === 'LI') {
                    // Insert after the outermost list rather than inside the list item.
                    let list = current.closest('ul, ol');
                    while (list && list.parentElement && list.parentElement !== editor && list.parentElement.closest('ul, ol')) {
                        list = list.parentElement.closest('ul, ol');
                    }
                    block = list;
                    break;
                }
                if (BLOCK_TAGS.indexOf(name) >= 0) {
                    block = current;
                    break;
                }
                current = current.parentElement;
            }

            if (block && block.parentNode) {
                parent = block.parentNode;
                reference = block.nextSibling;
            } else if (parent === editor && node && node !== editor) {
                // Caret in loose inline content directly under the editor.
                let top = node;
                while (top.parentNode && top.parentNode !== editor) top = top.parentNode;
                if (top.parentNode === editor) reference = top.nextSibling;
            }

            const el = document.createElement(tag);
            el.appendChild(document.createElement('br'));
            parent.insertBefore(el, reference);

            decorateEditorBlocks(editor);

            try {
                const r = document.createRange();
                r.selectNodeContents(el);
                r.collapse(true);
                sel.removeAllRanges();
                sel.addRange(r);
            } catch (e) {
                /* ignore */
            }

            this.content = editor.innerHTML;
            this.notifyChange();
            this.updateActiveStates();
        }
  } as any
);
