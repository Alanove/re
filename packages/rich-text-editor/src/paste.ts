// @ts-nocheck
/**
 * RichTextEditor mixin — paste.ts
 */
import { RichTextEditorCore } from './core';
import { sanitizeUrl } from './url-sanitize';

Object.assign(
  RichTextEditorCore.prototype,
  {

        stripFigmaBufferFromHtmlString(html) {
            if (!html || html.indexOf('data-buffer') === -1) {
                return html;
            }
            const figmaMarker = /(?:\(figma\)|&lt;!--\s*\(figma\)|<!--\s*\(figma\)|ZmlnLWtpd2lq)/i;
            let out = html.replace(
                /<span\b[^>]*\bdata-buffer="([^"]*)"[^>]*>\s*<\/span>/gi,
                (full, buf) => (figmaMarker.test(buf) ? '' : full)
            );
            out = out.replace(
                /<span\b[^>]*\bdata-buffer='([^']*)'[^>]*>\s*<\/span>/gi,
                (full, buf) => (figmaMarker.test(buf) ? '' : full)
            );
            return out;
        }
    
        /**
         * DOM fallback: remove span[data-buffer] nodes that carry Figma paste metadata.
         * @param {ParentNode} root
         */,

        removeFigmaDataBufferSpans(root) {
            if (!root || !root.querySelectorAll) {
                return;
            }
            root.querySelectorAll('span[data-buffer]').forEach((el) => {
                const buf = el.getAttribute('data-buffer') || '';
                if (/\(figma\)|<!--\s*\(figma\)|ZmlnLWtpd2lq/i.test(buf)) {
                    el.remove();
                }
            });
        }
    
        /**
         * Remove HTML comments (including multiline).
         * @param {string} html
         * @returns {string}
         */,

        stripHtmlComments(html) {
            if (!html || html.indexOf('<!--') === -1) {
                return html;
            }
            return html.replace(/<!--[\s\S]*?-->/g, '');
        }
    
        /**
         * Paste sanitizer: minimal semantic tags only, no classes/styles/data attrs,
         * unwraps divs/sections/tables to plain structure, drops scripts/media chrome.
         * @param {string} html
         * @returns {string}
         */,

        sanitizePastedHtml(html) {
            if (!html) {
                return '';
            }
    
            html = this.stripHtmlComments(html);
            html = this.stripFigmaBufferFromHtmlString(html);
    
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            this.removeFigmaDataBufferSpans(tempDiv);
    
            const out = document.createElement('div');
            const allowed = new Set([
                'P', 'BR', 'SPAN', 'UL', 'OL', 'LI',
                'STRONG', 'B', 'EM', 'I', 'U', 'S', 'STRIKE',
                'A', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
                'BLOCKQUOTE', 'HR', 'IMG', 'SUB', 'SUP', 'CODE', 'PRE'
            ]);
            const removeSubtree = new Set([
                'SCRIPT', 'STYLE', 'META', 'LINK', 'IFRAME', 'OBJECT', 'EMBED',
                'FORM', 'INPUT', 'BUTTON', 'SELECT', 'TEXTAREA', 'NOSCRIPT',
                'SVG', 'CANVAS', 'BASE', 'MAP', 'AREA', 'FRAME', 'FRAMESET',
                'TEMPLATE', 'VIDEO', 'AUDIO', 'SOURCE', 'TRACK'
            ]);
    
            const appendSanitized = (parent, node) => {
                if (node.nodeType === Node.COMMENT_NODE) {
                    return;
                }
                if (node.nodeType === Node.TEXT_NODE) {
                    parent.appendChild(document.createTextNode(node.textContent));
                    return;
                }
                if (node.nodeType !== Node.ELEMENT_NODE) {
                    return;
                }
    
                const tag = node.tagName.toUpperCase();
                if (removeSubtree.has(tag)) {
                    return;
                }

                if (allowed.has(tag)) {
                    const el = document.createElement(tag.toLowerCase());
                    if (tag === 'A') {
                        const href = sanitizeUrl(node.getAttribute('href'), 'href');
                        if (href) {
                            el.setAttribute('href', href);
                            const tgt = (node.getAttribute('target') || '').toLowerCase();
                            if (tgt === '_blank') {
                                el.setAttribute('target', '_blank');
                                el.setAttribute('rel', 'noopener noreferrer');
                            }
                        } else {
                            Array.from(node.childNodes).forEach((ch) => appendSanitized(parent, ch));
                            return;
                        }
                    } else if (tag === 'IMG') {
                        const src = sanitizeUrl(node.getAttribute('src'), 'src');
                        if (!src) {
                            return;
                        }
                        el.setAttribute('src', src);
                        const alt = node.getAttribute('alt');
                        if (alt != null) {
                            el.setAttribute('alt', alt);
                        }
                    }
                    Array.from(node.childNodes).forEach((ch) => appendSanitized(el, ch));
                    const voidEl =
                        tag === 'BR' ||
                        tag === 'HR' ||
                        tag === 'IMG' ||
                        (tag === 'A' && el.hasAttribute('href'));
                    if (voidEl || el.hasChildNodes()) {
                        parent.appendChild(el);
                    }
                    return;
                }
    
                Array.from(node.childNodes).forEach((ch) => appendSanitized(parent, ch));
            };
    
            Array.from(tempDiv.childNodes).forEach((ch) => appendSanitized(out, ch));
    
            return out.innerHTML;
        }
    
        /**
         * Approximate visual line count from block elements / <br>.
         */,

        countVisualLines() {
            if (!this.richTextEditor) {
                return 0;
            }
            const html = this.richTextEditor.innerHTML || '';
            if (!html.trim() || html === '<br>') {
                return 0;
            }
            const maxLines = parseInt(this.options.maxLines, 10) || 0;
            if (maxLines === 1) {
                return 1;
            }
            const brs = (html.match(/<br\s*\/?>/gi) || []).length;
            const blocks = this.richTextEditor.querySelectorAll('p, div, h1, h2, h3, h4, h5, h6, li').length;
            return Math.max(1, brs + 1, blocks || 1);
        }
    
        /**
         * Collapse HTML to respect maxLines (especially single-line mini editors).
         */,

        enforceMaxLinesOnHtml(html) {
            const maxLines = parseInt(this.options.maxLines, 10) || 0;
            if (!maxLines || !html) {
                return html;
            }
            if (maxLines === 1) {
                const tmp = document.createElement('div');
                tmp.innerHTML = html;
                const text = (tmp.textContent || '').replace(/\s+/g, ' ').trim();
                return text ? this.escapeHtmlText(text) : '';
            }
            return html;
        },

        escapeHtmlText(text) {
            return String(text)
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;');
        },

        /**
         * Find an image File in a clipboard DataTransfer (screenshot / copy image).
         * @param {DataTransfer} clipboardData
         * @returns {File|null}
         */
        getClipboardImageFile(clipboardData) {
            if (!clipboardData) return null;
            if (clipboardData.files && clipboardData.files.length) {
                for (let i = 0; i < clipboardData.files.length; i++) {
                    const f = clipboardData.files[i];
                    if (f && f.type && f.type.indexOf('image/') === 0) {
                        return f;
                    }
                }
            }
            const items = clipboardData.items;
            if (!items) return null;
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item && item.kind === 'file' && item.type && item.type.indexOf('image/') === 0) {
                    const file = item.getAsFile();
                    if (file) return file;
                }
            }
            return null;
        },

        /**
         * Upload a pasted image via fileManager and insert an <img> at the caret.
         * @param {File} file
         */
        async pasteImageFromClipboard(file) {
            const fm = this.getFileManager();
            if (!fm || !fm.uploadUrl) {
                this.showPasteImageError('Image upload is not configured for this editor.');
                return;
            }
            if (!file) {
                this.showPasteImageError('No image found on the clipboard.');
                return;
            }

            const editor = this.richTextEditor;
            if (!editor) {
                return;
            }

            // Inserted as a DOM node: execCommand('insertHTML') drops the span attributes in Chromium.
            const marker = document.createElement('span');
            marker.className = 'rte-paste-upload';
            marker.contentEditable = 'false';
            marker.textContent = 'Uploading image…';

            this.restoreSavedSelection();
            editor.focus();
            const sel = window.getSelection();
            const range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
            if (range && editor.contains(range.commonAncestorContainer)) {
                range.deleteContents();
                range.insertNode(marker);
                range.setStartAfter(marker);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
            } else {
                editor.appendChild(marker);
            }

            try {
                const mapped = await this.fileManagerUpload(file);
                const url = (mapped && (mapped.url || mapped.fileUrl)) || '';
                const name = (mapped && (mapped.name || mapped.fileName)) || file.name || 'image';
                const safeSrc = sanitizeUrl(url, 'src');
                if (!safeSrc) {
                    throw new Error('Upload did not return an image URL');
                }
                const img = document.createElement('img');
                img.setAttribute('src', safeSrc);
                img.alt = name;
                img.className = 'rte-img-fluid';

                if (marker.isConnected) {
                    marker.replaceWith(img);
                } else {
                    editor.appendChild(img);
                }
                this.content = editor.innerHTML;
                editor.dispatchEvent(new Event('input', { bubbles: true }));
                this.notifyChange();
            } catch (err) {
                if (marker.isConnected) {
                    marker.remove();
                }
                this.showPasteImageError(
                    (err && err.message) || 'Failed to upload pasted image'
                );
            }
        },

        showPasteImageError(message) {
            console.error('RichTextEditor paste image:', message);
            if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                window.alert(message);
            }
        },

        /**
         * Rich-mode paste: images upload via fileManager; otherwise sanitize HTML/text.
         * @param {ClipboardEvent} e
         */
        handleRichPaste(e) {
            const clipboardData = e.clipboardData || window.clipboardData;
            if (!clipboardData) {
                return;
            }

            const imageFile = this.getClipboardImageFile(clipboardData);
            if (imageFile) {
                e.preventDefault();
                e.stopPropagation();
                this.pasteImageFromClipboard(imageFile);
                return;
            }

            e.preventDefault();

            let pastedData = clipboardData.getData('text/html');
            if (!pastedData) {
                pastedData = clipboardData.getData('text/plain');
                if (pastedData) {
                    const maxLines = parseInt(this.options.maxLines, 10) || 0;
                    if (maxLines === 1) {
                        pastedData = pastedData.replace(/[\r\n]+/g, ' ').trim();
                    } else {
                        pastedData = pastedData.replace(/\n/g, '<br>');
                    }
                }
            }

            if (!pastedData) {
                return;
            }

            pastedData = this.stripFigmaBufferFromHtmlString(pastedData);
            let cleanedHTML = this.sanitizePastedHtml(pastedData);
            cleanedHTML = this.enforceMaxLinesOnHtml(cleanedHTML);

            const selection = window.getSelection();
            if (!selection.rangeCount) {
                const range = document.createRange();
                range.selectNodeContents(this.richTextEditor);
                range.collapse(false);
                selection.removeAllRanges();
                selection.addRange(range);
            }

            const range = selection.getRangeAt(0);
            range.deleteContents();

            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = cleanedHTML;
            const fragment = document.createDocumentFragment();
            while (tempDiv.firstChild) {
                fragment.appendChild(tempDiv.firstChild);
            }

            if (fragment.childNodes.length > 0) {
                range.insertNode(fragment);
                const lastNode = fragment.lastChild;
                if (lastNode) {
                    range.setStartAfter(lastNode);
                    range.collapse(true);
                }
            } else {
                const textNode = document.createTextNode('');
                range.insertNode(textNode);
                range.setStartAfter(textNode);
                range.collapse(true);
            }

            selection.removeAllRanges();
            selection.addRange(range);
            this.richTextEditor.dispatchEvent(new Event('input', { bubbles: true }));
        }
  } as any
);
