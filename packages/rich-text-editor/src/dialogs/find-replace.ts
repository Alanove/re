// @ts-nocheck
/**
 * RichTextEditor mixin — find-replace.ts
 * Non-modal find / find-and-replace panel for the rich surface.
 */
import { RichTextEditorCore } from '../core';

const HIGHLIGHT_ALL = 'rte-find';
const HIGHLIGHT_CURRENT = 'rte-find-current';
const BLOCK_SELECTOR = 'p, div, li, td, th, h1, h2, h3, h4, h5, h6, pre, blockquote, figcaption, dt, dd';
const SKIP_SELECTOR = 'button, select, option, script, style, textarea';

// CSS highlight names are global, so only one editor shows find results at a time.
let openFindEditor = null;

function supportsHighlights() {
    return typeof CSS !== 'undefined' && !!CSS.highlights && typeof Highlight === 'function';
}

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function clearHighlights() {
    if (!supportsHighlights()) return;
    CSS.highlights.delete(HIGHLIGHT_ALL);
    CSS.highlights.delete(HIGHLIGHT_CURRENT);
}

function iconButton(icon, title, extraClass) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'rte-find-btn' + (extraClass ? ' ' + extraClass : '');
    btn.title = title;
    btn.setAttribute('aria-label', title);
    btn.innerHTML = icon;
    return btn;
}

Object.assign(
  RichTextEditorCore.prototype,
  {
        hasToolbarAction(action) {
            return (this.options.toolbar || []).indexOf(action) >= 0;
        },

        createFindPanel() {
            const state = {
                matches: [],
                index: -1,
                matchCase: false,
                wholeWord: false,
                searchTimer: null
            };

            const panel = document.createElement('div');
            panel.className = 'rte-find-panel';
            panel.setAttribute('role', 'search');
            panel.setAttribute('aria-label', 'Find and replace');
            panel.hidden = true;

            const findRow = document.createElement('div');
            findRow.className = 'rte-find-row';
            const findInput = document.createElement('input');
            findInput.type = 'text';
            findInput.className = 'rte-find-input';
            findInput.placeholder = 'Find';
            findInput.setAttribute('aria-label', 'Find');
            findInput.spellcheck = false;
            findInput.autocomplete = 'off';
            const counter = document.createElement('span');
            counter.className = 'rte-find-count';
            counter.setAttribute('aria-live', 'polite');
            const caseBtn = iconButton('Aa', 'Match case', 'rte-find-toggle');
            caseBtn.setAttribute('aria-pressed', 'false');
            const wordBtn = iconButton('<span class="rte-find-word">ab</span>', 'Whole word', 'rte-find-toggle');
            wordBtn.setAttribute('aria-pressed', 'false');
            const prevBtn = iconButton('<i class="fas fa-arrow-up" aria-hidden="true"></i>', 'Previous match (Shift+Enter)');
            const nextBtn = iconButton('<i class="fas fa-arrow-down" aria-hidden="true"></i>', 'Next match (Enter)');
            const closeBtn = iconButton('<i class="fas fa-times" aria-hidden="true"></i>', 'Close (Esc)');
            findRow.append(findInput, counter, caseBtn, wordBtn, prevBtn, nextBtn, closeBtn);

            const replaceRow = document.createElement('div');
            replaceRow.className = 'rte-find-row rte-find-replace-row';
            const replaceInput = document.createElement('input');
            replaceInput.type = 'text';
            replaceInput.className = 'rte-find-input';
            replaceInput.placeholder = 'Replace with';
            replaceInput.setAttribute('aria-label', 'Replace with');
            replaceInput.spellcheck = false;
            replaceInput.autocomplete = 'off';
            const replaceBtn = document.createElement('button');
            replaceBtn.type = 'button';
            replaceBtn.className = 'rte-find-action';
            replaceBtn.textContent = 'Replace';
            const replaceAllBtn = document.createElement('button');
            replaceAllBtn.type = 'button';
            replaceAllBtn.className = 'rte-find-action';
            replaceAllBtn.textContent = 'Replace all';
            replaceRow.append(replaceInput, replaceBtn, replaceAllBtn);

            panel.append(findRow, replaceRow);

            const toggle = (btn, key) => {
                state[key] = !state[key];
                btn.classList.toggle('active', state[key]);
                btn.setAttribute('aria-pressed', state[key] ? 'true' : 'false');
                this.runFindSearch({ keepIndex: false });
            };

            findInput.addEventListener('input', () => this.runFindSearch({ keepIndex: false }));
            caseBtn.addEventListener('click', () => toggle(caseBtn, 'matchCase'));
            wordBtn.addEventListener('click', () => toggle(wordBtn, 'wholeWord'));
            prevBtn.addEventListener('click', () => this.findStep(-1));
            nextBtn.addEventListener('click', () => this.findStep(1));
            closeBtn.addEventListener('click', () => this.hideFindPanel(true));
            replaceBtn.addEventListener('click', () => this.replaceCurrentMatch());
            replaceAllBtn.addEventListener('click', () => this.replaceAllMatches());

            panel.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.hideFindPanel(true);
                    return;
                }
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (e.target === replaceInput) {
                        this.replaceCurrentMatch();
                    } else {
                        this.findStep(e.shiftKey ? -1 : 1);
                    }
                }
            });

            this._onFindContentInput = () => {
                if (!this._find || this._find.panel.hidden) return;
                clearTimeout(this._find.searchTimer);
                this._find.searchTimer = setTimeout(() => this.runFindSearch({ keepIndex: true }), 150);
            };
            this.richTextEditor.addEventListener('input', this._onFindContentInput);

            if (getComputedStyle(this.editorContainer).position === 'static') {
                this.editorContainer.style.position = 'relative';
            }
            this.editorContainer.appendChild(panel);

            Object.assign(state, { panel, findInput, replaceInput, replaceRow, counter });
            this._find = state;
            return state;
        },

        showFindPanel(withReplace) {
            if (this.currentMode !== 'rich' || !this.richTextEditor) return;
            if (openFindEditor && openFindEditor !== this) {
                openFindEditor.hideFindPanel(false);
            }
            openFindEditor = this;

            const state = this._find || this.createFindPanel();
            const selected = this.getSelectedTextInEditor();
            if (selected) {
                state.findInput.value = selected;
            }
            state.replaceRow.hidden = !withReplace;
            state.panel.classList.toggle('is-replace', !!withReplace);

            const toolbarDocked = this.toolbar && !this.toolbar.hidden && this.toolbar.parentNode === this.editorContainer;
            state.panel.style.top = ((toolbarDocked ? this.toolbar.offsetHeight : 0) + 6) + 'px';
            state.panel.hidden = false;

            this.runFindSearch({ keepIndex: false, fromCaret: true });
            state.findInput.focus();
            state.findInput.select();
        },

        hideFindPanel(restoreFocus) {
            const state = this._find;
            if (!state || state.panel.hidden) return;
            clearTimeout(state.searchTimer);
            state.panel.hidden = true;
            const current = state.matches[state.index];
            state.matches = [];
            state.index = -1;
            if (openFindEditor === this) {
                clearHighlights();
                openFindEditor = null;
            }
            if (restoreFocus && this.richTextEditor && this.currentMode === 'rich') {
                this.richTextEditor.focus();
                if (current && current.range) {
                    const sel = window.getSelection();
                    sel.removeAllRanges();
                    sel.addRange(current.range);
                }
            }
        },

        teardownFindPanel() {
            this.hideFindPanel(false);
            if (this._onFindContentInput && this.richTextEditor) {
                this.richTextEditor.removeEventListener('input', this._onFindContentInput);
            }
            if (this._find && this._find.panel.parentNode) {
                this._find.panel.parentNode.removeChild(this._find.panel);
            }
            this._find = null;
        },

        getSelectedTextInEditor() {
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount || sel.isCollapsed) return '';
            const range = sel.getRangeAt(0);
            if (!this.richTextEditor.contains(range.commonAncestorContainer)) return '';
            const text = sel.toString();
            return text && text.length <= 200 && text.indexOf('\n') < 0 ? text : '';
        },

        /** Text of the rich surface plus a map from string offsets back to text nodes. */
        collectFindText() {
            const root = this.richTextEditor;
            const segments = [];
            let text = '';
            let lastBlock = null;
            const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
                acceptNode: (node) => {
                    const parent = node.parentElement;
                    if (!parent || parent.closest(SKIP_SELECTOR)) return NodeFilter.FILTER_REJECT;
                    return node.data.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
                }
            });
            let node = walker.nextNode();
            while (node) {
                const block = node.parentElement.closest(BLOCK_SELECTOR) || root;
                if (lastBlock && block !== lastBlock) {
                    text += '\n';
                }
                lastBlock = block;
                segments.push({ node, start: text.length, end: text.length + node.data.length });
                text += node.data;
                node = walker.nextNode();
            }
            return { text, segments };
        },

        runFindSearch(opts) {
            const state = this._find;
            if (!state) return;
            const options = opts || {};
            const query = state.findInput.value;
            const previous = state.matches[state.index];
            state.matches = [];

            if (query) {
                const { text, segments } = this.collectFindText();
                let pattern = escapeRegExp(query);
                if (state.wholeWord) {
                    pattern = '(?<![\\p{L}\\p{N}_])' + pattern + '(?![\\p{L}\\p{N}_])';
                }
                const re = new RegExp(pattern, 'gu' + (state.matchCase ? '' : 'i'));
                const locate = (offset, isEnd) => {
                    for (let i = 0; i < segments.length; i++) {
                        const seg = segments[i];
                        if (isEnd ? (offset > seg.start && offset <= seg.end) : (offset >= seg.start && offset < seg.end)) {
                            return { node: seg.node, offset: offset - seg.start };
                        }
                    }
                    return null;
                };
                let m;
                while ((m = re.exec(text)) !== null) {
                    if (!m[0].length) {
                        re.lastIndex++;
                        continue;
                    }
                    const start = locate(m.index, false);
                    const end = locate(m.index + m[0].length, true);
                    if (!start || !end) continue;
                    const range = document.createRange();
                    range.setStart(start.node, start.offset);
                    range.setEnd(end.node, end.offset);
                    state.matches.push({ range, start: m.index, end: m.index + m[0].length });
                }
            }

            if (!state.matches.length) {
                state.index = -1;
            } else if (typeof options.fromOffset === 'number') {
                const idx = state.matches.findIndex((match) => match.start >= options.fromOffset);
                state.index = idx >= 0 ? idx : 0;
            } else if (options.keepIndex && previous) {
                const idx = state.matches.findIndex((match) => match.start >= previous.start);
                state.index = idx >= 0 ? idx : state.matches.length - 1;
            } else if (options.fromCaret) {
                state.index = this.findMatchIndexNearCaret(state.matches);
            } else {
                state.index = 0;
            }

            this.renderFindResults(!options.keepIndex);
        },

        findMatchIndexNearCaret(matches) {
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount) return 0;
            const caret = sel.getRangeAt(0);
            if (!this.richTextEditor.contains(caret.startContainer)) return 0;
            for (let i = 0; i < matches.length; i++) {
                try {
                    if (matches[i].range.compareBoundaryPoints(Range.START_TO_START, caret) >= 0) return i;
                } catch (e) {
                    return 0;
                }
            }
            return 0;
        },

        renderFindResults(scroll) {
            const state = this._find;
            if (!state) return;
            const total = state.matches.length;
            const hasQuery = !!state.findInput.value;
            state.counter.textContent = !hasQuery ? '' : (total ? (state.index + 1) + ' of ' + total : 'No results');
            state.panel.classList.toggle('has-no-results', hasQuery && !total);

            const current = state.matches[state.index];
            if (supportsHighlights() && openFindEditor === this) {
                CSS.highlights.set(HIGHLIGHT_ALL, new Highlight(...state.matches.map((match) => match.range)));
                if (current) {
                    CSS.highlights.set(HIGHLIGHT_CURRENT, new Highlight(current.range));
                } else {
                    CSS.highlights.delete(HIGHLIGHT_CURRENT);
                }
            } else if (current && !supportsHighlights()) {
                const sel = window.getSelection();
                sel.removeAllRanges();
                sel.addRange(current.range.cloneRange());
            }

            if (scroll && current) {
                const anchor = current.range.startContainer.parentElement;
                if (anchor && typeof anchor.scrollIntoView === 'function') {
                    anchor.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                }
            }
        },

        findStep(direction) {
            const state = this._find;
            if (!state) return;
            this.runFindSearch({ keepIndex: true });
            const total = state.matches.length;
            if (!total) return;
            state.index = (state.index + direction + total) % total;
            this.renderFindResults(true);
        },

        replaceMatchRange(range, replacement) {
            const startNode = range.startContainer;
            const startOffset = range.startOffset;
            range.deleteContents();
            if (startNode.nodeType === Node.TEXT_NODE && startNode.isConnected) {
                startNode.insertData(startOffset, replacement);
            } else if (replacement) {
                range.insertNode(document.createTextNode(replacement));
            }
        },

        afterFindReplace() {
            this.flushRichHistoryImmediate();
            this.content = this.richTextEditor.innerHTML;
            this.notifyChange();
        },

        replaceCurrentMatch() {
            const state = this._find;
            if (!state || this.currentMode !== 'rich') return;
            this.runFindSearch({ keepIndex: true });
            const current = state.matches[state.index];
            if (!current) return;
            const replacement = state.replaceInput.value;
            this.flushRichHistoryImmediate();
            this.replaceMatchRange(current.range, replacement);
            this.afterFindReplace();
            this.runFindSearch({ fromOffset: current.start + replacement.length });
        },

        replaceAllMatches() {
            const state = this._find;
            if (!state || this.currentMode !== 'rich') return;
            this.runFindSearch({ keepIndex: false });
            const matches = state.matches.slice();
            if (!matches.length) return;
            const replacement = state.replaceInput.value;
            this.flushRichHistoryImmediate();
            for (let i = matches.length - 1; i >= 0; i--) {
                this.replaceMatchRange(matches[i].range, replacement);
            }
            this.afterFindReplace();
            this.runFindSearch({ keepIndex: false });
            state.counter.textContent = 'Replaced ' + matches.length;
        }
  } as any
);
