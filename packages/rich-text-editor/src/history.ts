// @ts-nocheck
/**
 * RichTextEditor mixin — history.ts
 */
import { RichTextEditorCore } from './core';
import { sanitizeEditorHtml } from './sanitize-editor-html';
import { decorateEditorBlocks } from './template-blocks';

Object.assign(
  RichTextEditorCore.prototype,
  {

        resetRichHistory() {
            if (!this.richTextEditor) return;
            const html = this.richTextEditor.innerHTML;
            this.richHistory = [html];
            this.richHistoryCursor = 0;
        },

        scheduleRichHistoryRecord() {
            if (this._richHistoryApplying || this.currentMode !== 'rich' || !this.richTextEditor) return;
            clearTimeout(this._richHistoryRecordTimer);
            this._richHistoryRecordTimer = setTimeout(() => {
                this._richHistoryRecordTimer = null;
                this.flushRichHistory();
            }, 280);
        },

        flushRichHistoryImmediate() {
            clearTimeout(this._richHistoryRecordTimer);
            this._richHistoryRecordTimer = null;
            this.flushRichHistory();
        },

        flushRichHistory() {
            if (this._richHistoryApplying || this.currentMode !== 'rich' || !this.richTextEditor) return;
            const html = this.richTextEditor.innerHTML;
            const at = this.richHistory[this.richHistoryCursor];
            if (html === at) return;
            this.richHistory = this.richHistory.slice(0, this.richHistoryCursor + 1);
            this.richHistory.push(html);
            this.richHistoryCursor = this.richHistory.length - 1;
            while (this.richHistory.length > this.richHistoryMax) {
                this.richHistory.shift();
                this.richHistoryCursor--;
            }
        },

        applyRichHistoryIndex(cursor) {
            if (!this.richTextEditor || cursor < 0 || cursor >= this.richHistory.length) return;
            this._richHistoryApplying = true;
            const html = sanitizeEditorHtml(this.richHistory[cursor]);
            this.richTextEditor.innerHTML = html;
            decorateEditorBlocks(this.richTextEditor);
            // Sanitize + decorate can normalize the markup; store that form so the next flush
            // does not see a spurious change and drop the redo stack.
            this.richHistory[cursor] = this.richTextEditor.innerHTML;
            this.content = html;
            this._richHistoryApplying = false;
            this.richHistoryCursor = cursor;
            this.updateWordCount();
            this.updateActiveStates();
            this.richTextEditor.dispatchEvent(new Event('input', { bubbles: true }));
        },

        performRichUndo() {
            if (this.richHistoryCursor <= 0) return false;
            this.applyRichHistoryIndex(this.richHistoryCursor - 1);
            return true;
        },

        performRichRedo() {
            if (this.richHistoryCursor >= this.richHistory.length - 1) return false;
            this.applyRichHistoryIndex(this.richHistoryCursor + 1);
            return true;
        }
  } as any
);
