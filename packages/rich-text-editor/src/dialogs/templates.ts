// @ts-nocheck
/**
 * RichTextEditor mixin — dialogs/templates.ts
 */
import { RichTextEditorCore } from '../core';
import { sanitizeEditorHtml } from '../sanitize-editor-html';
import { decorateEditorBlocks } from '../template-blocks';
import { RTE_Z_MODAL } from '../z-index';

const RTE_TEMPLATE_INSERT_POS_KEY = 'rteTemplateInsertPos';

function getStoredInsertPosition() {
    try {
        const v = sessionStorage.getItem(RTE_TEMPLATE_INSERT_POS_KEY);
        if (v === 'start' || v === 'end' || v === 'cursor') return v;
    } catch (e) {
        /* ignore */
    }
    return 'end';
}

function storeInsertPosition(pos) {
    try {
        sessionStorage.setItem(RTE_TEMPLATE_INSERT_POS_KEY, pos);
    } catch (e) {
        /* ignore */
    }
}

function closeTemplatesOverlay(overlay) {
    if (!overlay) return;
    if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
    }
}

function buildInsertPositionBar(showBar) {
    if (!showBar) return null;
    const bar = document.createElement('div');
    bar.className = 'rte-template-insert-pos';
    bar.style.cssText =
        'display:flex;flex-wrap:wrap;align-items:center;gap:12px 20px;padding:0 0 12px;margin:0 0 8px;border-bottom:1px solid #eee;';
    bar.innerHTML = `
        <span style="font-size:13px;font-weight:600;color:#333;">Insert at:</span>
        <label style="font-size:13px;margin:0;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
            <input type="radio" name="rteTemplateInsertPos" value="cursor"> At cursor
        </label>
        <label style="font-size:13px;margin:0;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
            <input type="radio" name="rteTemplateInsertPos" value="start"> At beginning
        </label>
        <label style="font-size:13px;margin:0;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">
            <input type="radio" name="rteTemplateInsertPos" value="end"> At end
        </label>
    `;
    const current = getStoredInsertPosition();
    bar.querySelectorAll('input[name="rteTemplateInsertPos"]').forEach((input) => {
        input.checked = input.value === current;
    });
    bar.addEventListener('change', (e) => {
        const t = e.target;
        if (t && t.name === 'rteTemplateInsertPos' && t.checked) {
            storeInsertPosition(t.value);
        }
    });
    return bar;
}

Object.assign(
  RichTextEditorCore.prototype,
  {

        /**
         * Templates picker as a custom .rte-modal overlay (same pattern as link/image).
         * Avoids Bootstrap nested-modal hang (black backdrop only) inside component edit.
         */
        showTemplatesModal() {
            document.querySelectorAll('#templatesModal').forEach((el) => {
                closeTemplatesOverlay(el);
            });

            const maxLines = parseInt(String(this.options.maxLines ?? 0), 10) || 0;
            const isMiniSingleLine = maxLines === 1 || this.isMiniPreset();
            const editorInst = this;
            // Template availability lists only know 'mini' and 'full', whatever the toolbar preset is called.
            const preset = this.isMiniPreset() ? 'mini' : 'full';

            const overlay = document.createElement('div');
            overlay.id = 'templatesModal';
            overlay.className = 'rte-modal rte-templates-modal';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-label', 'Select Template');
            overlay.style.cssText = [
                'position: fixed',
                'top: 0',
                'left: 0',
                'width: 100%',
                'height: 100%',
                'background: rgba(0, 0, 0, 0.5)',
                'display: flex',
                'align-items: center',
                'justify-content: center',
                'z-index: ' + RTE_Z_MODAL,
                'padding: 16px',
                'box-sizing: border-box'
            ].join(';') + ';';
            overlay._rteInstance = this;

            const panel = document.createElement('div');
            panel.className = 'rte-templates-panel';
            panel.style.cssText = [
                'background: #fff',
                'border-radius: 8px',
                'width: min(1100px, 96vw)',
                'max-height: min(90vh, 900px)',
                'display: flex',
                'flex-direction: column',
                'box-shadow: 0 8px 32px rgba(0,0,0,0.28)',
                'overflow: hidden'
            ].join(';') + ';';

            const header = document.createElement('div');
            header.style.cssText =
                'display:flex;align-items:center;justify-content:space-between;padding:16px 20px;border-bottom:1px solid #dee2e6;flex:0 0 auto;';
            const title = document.createElement('h4');
            title.className = 'modal-title';
            title.textContent = 'Select Template';
            title.style.cssText = 'margin:0;font-size:1.15rem;';
            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'btn-close';
            closeBtn.setAttribute('aria-label', 'Close');
            closeBtn.addEventListener('click', () => closeTemplatesOverlay(overlay));
            header.appendChild(title);
            header.appendChild(closeBtn);

            const body = document.createElement('div');
            body.className = 'modal-body';
            body.style.cssText = 'padding:16px 20px;overflow:auto;flex:1 1 auto;min-height:0;';

            const posBar = buildInsertPositionBar(!isMiniSingleLine);
            if (posBar) body.appendChild(posBar);

            const templatesContainer = document.createElement('div');
            templatesContainer.className = 'rte-templates-container';
            templatesContainer.style.cssText =
                'display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px;padding:4px 0;align-items:stretch;';
            templatesContainer.innerHTML =
                '<div class="text-center w-100 text-muted" style="grid-column:1/-1;">Loading templates...</div>';
            body.appendChild(templatesContainer);

            const footer = document.createElement('div');
            footer.style.cssText =
                'display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid #dee2e6;flex:0 0 auto;';
            const cancelBtn = document.createElement('button');
            cancelBtn.type = 'button';
            cancelBtn.className = 'btn btn-white';
            cancelBtn.textContent = 'Cancel';
            cancelBtn.addEventListener('click', () => closeTemplatesOverlay(overlay));
            footer.appendChild(cancelBtn);

            panel.appendChild(header);
            panel.appendChild(body);
            panel.appendChild(footer);
            overlay.appendChild(panel);

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeTemplatesOverlay(overlay);
            });
            const onKey = (e) => {
                if (e.key === 'Escape') {
                    closeTemplatesOverlay(overlay);
                    document.removeEventListener('keydown', onKey, true);
                }
            };
            document.addEventListener('keydown', onKey, true);

            const closeAndCleanup = () => {
                document.removeEventListener('keydown', onKey, true);
                closeTemplatesOverlay(overlay);
            };

            document.body.appendChild(overlay);

            const loadPromise = this._templatesJsonCache
                ? Promise.resolve(this._templatesJsonCache)
                : (this._templatesJsonFetchPromise ||
                    (this._templatesJsonFetchPromise = fetch(this.getTemplatesUrl(), { cache: 'no-store' })
                        .then((res) => res.json())
                        .then((templates) => {
                            editorInst._templatesJsonCache = templates;
                            return templates;
                        })));

            loadPromise
                .then((templates) => {
                    if (overlay._rteInstance !== editorInst || !overlay.parentNode) return;

                    const filtered = (templates || []).filter((t) => {
                        const avail = (t && t.availableIn) || ['full'];
                        return Array.isArray(avail) && avail.indexOf(preset) >= 0;
                    });

                    templatesContainer.innerHTML = '';
                    if (!filtered.length) {
                        templatesContainer.innerHTML =
                            '<div class="text-muted w-100 text-center" style="grid-column:1/-1;">No templates available for this editor.</div>';
                        return;
                    }

                    filtered.forEach((template) => {
                        const card = document.createElement('div');
                        card.className = 'template-card';
                        card.style.cssText = [
                            'min-width: 0',
                            'width: 100%',
                            'border: 1px solid #ddd',
                            'border-radius: 6px',
                            'background: white',
                            'cursor: pointer',
                            'transition: all 0.2s ease',
                            'display: flex',
                            'flex-direction: column',
                            'overflow: hidden',
                            'box-sizing: border-box'
                        ].join(';') + ';';

                        const imgWrapper = document.createElement('div');
                        imgWrapper.style.cssText = [
                            'width: 100%',
                            'height: 180px',
                            'background: #f8f9fa',
                            'display: flex',
                            'align-items: center',
                            'justify-content: center',
                            'overflow: hidden',
                            'border-bottom: 1px solid #eee'
                        ].join(';') + ';';

                        if (template.thumb) {
                            const img = document.createElement('img');
                            img.src = editorInst.resolveTemplateThumbUrl(template.thumb);
                            img.alt = template.title;
                            img.style.cssText =
                                'width:100%;height:100%;object-fit:contain;object-position:center;';
                            img.onerror = () => {
                                img.style.display = 'none';
                                const fallbackText = document.createElement('div');
                                fallbackText.textContent = 'No Image';
                                fallbackText.style.cssText = 'color:#999;font-size:13px;font-weight:500;';
                                imgWrapper.appendChild(fallbackText);
                            };
                            imgWrapper.appendChild(img);
                        } else {
                            const preview = document.createElement('div');
                            preview.className = 'rte-template-preview rte-content';
                            preview.setAttribute('aria-hidden', 'true');
                            preview.innerHTML = sanitizeEditorHtml(editorInst.getTemplateHtml(template));
                            imgWrapper.style.alignItems = 'flex-start';
                            imgWrapper.style.justifyContent = 'flex-start';
                            imgWrapper.appendChild(preview);
                        }

                        const name = document.createElement('div');
                        name.textContent = template.title;
                        name.style.cssText =
                            'padding:12px;font-size:14px;text-align:center;font-weight:600;color:#333;line-height:1.3;';

                        card.appendChild(imgWrapper);
                        card.appendChild(name);

                        card.addEventListener('mouseenter', () => {
                            card.style.borderColor = 'var(--rte-accent)';
                            card.style.transform = 'translateY(-2px)';
                            card.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                        });
                        card.addEventListener('mouseleave', () => {
                            card.style.borderColor = '#ddd';
                            card.style.transform = 'translateY(0)';
                            card.style.boxShadow = 'none';
                        });

                        card.addEventListener('click', () => {
                            const editor = overlay._rteInstance;
                            const posInput = overlay.querySelector('input[name="rteTemplateInsertPos"]:checked');
                            const position = (posInput && posInput.value) || getStoredInsertPosition();
                            storeInsertPosition(position);
                            if (editor) editor.insertTemplate(template, position);
                            closeAndCleanup();
                        });

                        templatesContainer.appendChild(card);
                    });
                })
                .catch((err) => {
                    console.error('Error loading templates:', err);
                    templatesContainer.innerHTML =
                        '<div class="text-danger w-100 text-center" style="grid-column:1/-1;">Failed to load templates.</div>';
                });
        },

        /**
         * Resolves a template thumb path relative to templates.json (or returns absolute URLs unchanged).
         * @param {string} thumb - Value from templates.json `thumb`
         * @returns {string} URL usable as img.src
         */
        resolveTemplateThumbUrl(thumb) {
            if (!thumb || typeof thumb !== 'string') return '';
            const t = thumb.trim();
            if (!t) return '';
            if (/^(https?:|data:|blob:)/i.test(t) || t.startsWith('/')) return t;
            const base = this.getTemplatesUrl() || '/admin/editor/templates.json';
            const slash = base.lastIndexOf('/');
            const dir = slash >= 0 ? base.slice(0, slash + 1) : '/';
            return dir + t.replace(/^\.\//, '');
        },

        /**
         * Resolves which HTML to insert for a template.
         * - If template.content is an object with language keys (default, en, ar): use current language, then default fallback.
         * - Otherwise legacy: use contentAr when editor is Arabic and contentAr exists, else content.
         * @param {Object} template - Template object from templates.json
         * @returns {string} HTML string to insert
         */

        getTemplateHtml(template) {
            const lang = (this.options.languageCode || '').toLowerCase() || 'default';
            const c = template.content;
            let html = '';
            if (c && typeof c === 'object' && !Array.isArray(c)) {
                html = c[lang] || c.default || c.en || c.ar;
                if (typeof html !== 'string') {
                    html = Object.values(c).find((v) => typeof v === 'string') || '';
                }
            } else {
                const isArabic = lang === 'ar';
                html = isArabic && template.contentAr ? template.contentAr : template.content || '';
            }
            return html.split('{{templatesBase}}').join(this.resolveTemplateThumbUrl('./'));
        },

        /**
         * Returns true if the rich editor has no real content (empty, placeholder only, or just <br>).
         * When true, template insert should use append instead of execCommand so the first element is added.
         */

        _isRichEditorEffectivelyEmpty() {
            const html = (this.richTextEditor && this.richTextEditor.innerHTML) || '';
            const trimmed = html.trim();
            if (trimmed === '') return true;
            if (trimmed.includes('color: #999') && trimmed.includes('font-style: italic')) return true;
            const normalized = trimmed.replace(/<br\s*\/?>/gi, '').trim();
            return normalized === '';
        },

        /**
         * @param {Object} template
         * @param {'cursor'|'start'|'end'} [position]
         */
        insertTemplate(template, position) {
            let blockHtml = this.getTemplateHtml(template);
            if (!blockHtml || typeof blockHtml !== 'string') {
                console.warn('insertTemplate: no HTML to insert for template', template && template.id);
                return;
            }
            blockHtml = sanitizeEditorHtml(blockHtml);

            const maxLines = parseInt(String(this.options.maxLines ?? 0), 10) || 0;
            const isMiniSingleLine = maxLines === 1 || this.isMiniPreset();
            const insertPos = isMiniSingleLine ? 'cursor' : (position || getStoredInsertPosition() || 'end');

            if (this.currentMode === 'source') {
                if (isMiniSingleLine) {
                    this.sourceEditor.value = blockHtml;
                    this.sourceEditor.setSelectionRange(blockHtml.length, blockHtml.length);
                } else if (insertPos === 'start') {
                    this.sourceEditor.value = blockHtml + this.sourceEditor.value;
                    this.sourceEditor.setSelectionRange(blockHtml.length, blockHtml.length);
                } else if (insertPos === 'end') {
                    const before = this.sourceEditor.value;
                    this.sourceEditor.value = before + blockHtml;
                    this.sourceEditor.setSelectionRange(this.sourceEditor.value.length, this.sourceEditor.value.length);
                } else {
                    const cursorPos = this.sourceEditor.selectionStart;
                    const textBefore = this.sourceEditor.value.substring(0, cursorPos);
                    const textAfter = this.sourceEditor.value.substring(cursorPos);
                    this.sourceEditor.value = textBefore + blockHtml + textAfter;
                    const newPos = cursorPos + blockHtml.length;
                    this.sourceEditor.setSelectionRange(newPos, newPos);
                }
                this.sourceEditor.focus();
                this.content = this.sourceEditor.value;
                this.sourceEditor.dispatchEvent(new Event('input', { bubbles: true }));
                return;
            }

            this.richTextEditor.focus();
            const self = this;
            const doInsert = function () {
                // Mini single-line: always replace content (no second line / append)
                if (isMiniSingleLine) {
                    self.richTextEditor.innerHTML = blockHtml;
                    decorateEditorBlocks(self.richTextEditor);
                    try {
                        const sel = window.getSelection();
                        const r = document.createRange();
                        r.selectNodeContents(self.richTextEditor);
                        r.collapse(false);
                        sel.removeAllRanges();
                        sel.addRange(r);
                    } catch (err) {
                        /* ignore */
                    }
                    self.content = self.richTextEditor.innerHTML;
                    self.richTextEditor.dispatchEvent(new Event('input', { bubbles: true }));
                    self.updateWordCount();
                    return;
                }

                const placeCaretAtEnd = () => {
                    try {
                        const sel = window.getSelection();
                        const r = document.createRange();
                        r.selectNodeContents(self.richTextEditor);
                        r.collapse(false);
                        sel.removeAllRanges();
                        sel.addRange(r);
                    } catch (err) {
                        /* ignore */
                    }
                };

                if (insertPos === 'start') {
                    if (self._isRichEditorEffectivelyEmpty()) {
                        self.richTextEditor.innerHTML = blockHtml;
                    } else {
                        self.richTextEditor.insertAdjacentHTML('afterbegin', blockHtml);
                    }
                    decorateEditorBlocks(self.richTextEditor);
                    placeCaretAtEnd();
                } else if (insertPos === 'end') {
                    if (self._isRichEditorEffectivelyEmpty()) {
                        self.richTextEditor.innerHTML = blockHtml;
                    } else {
                        self.richTextEditor.insertAdjacentHTML('beforeend', blockHtml);
                    }
                    decorateEditorBlocks(self.richTextEditor);
                    placeCaretAtEnd();
                } else {
                    const isEmpty = self._isRichEditorEffectivelyEmpty();
                    let usedExec = false;
                    if (!isEmpty) {
                        const sel = window.getSelection();
                        if (sel.rangeCount > 0) {
                            const range = sel.getRangeAt(0);
                            if (self.richTextEditor.contains(range.commonAncestorContainer)) {
                                try {
                                    document.execCommand('insertHTML', false, blockHtml);
                                    usedExec = true;
                                } catch (e) {
                                    console.warn('insertTemplate execCommand failed', e);
                                }
                            }
                        }
                    }
                    if (!usedExec) {
                        if (isEmpty) {
                            self.richTextEditor.innerHTML = blockHtml;
                        } else {
                            self.richTextEditor.insertAdjacentHTML('beforeend', blockHtml);
                        }
                        placeCaretAtEnd();
                    }
                    decorateEditorBlocks(self.richTextEditor);
                }

                self.content = self.richTextEditor.innerHTML;
                self.richTextEditor.dispatchEvent(new Event('input', { bubbles: true }));
                self.updateWordCount();
            };
            if (typeof requestAnimationFrame !== 'undefined') {
                requestAnimationFrame(doInsert);
            } else {
                setTimeout(doInsert, 0);
            }
        },
  } as any
);
