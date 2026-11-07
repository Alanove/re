// @ts-nocheck
/**
 * RichTextEditor mixin — dialogs/preview.ts
 */
import { RichTextEditorCore } from '../core';
import { RTE_Z_MODAL } from '../z-index';

function closePreviewOverlay(overlay) {
    if (!overlay) return;
    if (typeof overlay._rteCleanup === 'function') {
        overlay._rteCleanup();
    }
    if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
    }
}

Object.assign(
  RichTextEditorCore.prototype,
  {

        /**
         * Read-only preview of the current HTML, rendered with the editor content styles.
         */
        showPreviewModal() {
            document.querySelectorAll('.rte-preview-modal').forEach((el) => {
                closePreviewOverlay(el);
            });

            const html = this.getHTML() || '';

            const overlay = document.createElement('div');
            overlay.className = 'rte-modal rte-preview-modal';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-label', 'Preview');
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

            const panel = document.createElement('div');
            panel.className = 'rte-preview-panel';
            panel.style.cssText = [
                'background: #fff',
                'border-radius: 8px',
                'width: min(1100px, 96vw)',
                'max-height: 90vh',
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
            title.textContent = 'Preview';
            title.style.cssText = 'margin:0;font-size:1.15rem;';
            const closeBtn = document.createElement('button');
            closeBtn.type = 'button';
            closeBtn.className = 'btn-close';
            closeBtn.setAttribute('aria-label', 'Close');
            closeBtn.addEventListener('click', () => closePreviewOverlay(overlay));
            header.appendChild(title);
            header.appendChild(closeBtn);

            const body = document.createElement('div');
            body.className = 'modal-body';
            body.style.cssText = 'padding:16px 20px;overflow:auto;flex:1 1 auto;min-height:0;';

            const content = document.createElement('div');
            content.className = 'rte-rich rte-preview-content';
            if (this.options.languageCode && String(this.options.languageCode).toLowerCase() === 'ar') {
                content.setAttribute('dir', 'rtl');
            }
            if (html.replace(/<br\s*\/?>/gi, '').trim()) {
                content.innerHTML = html;
            } else {
                content.innerHTML = '<p class="rte-preview-empty">Nothing to preview.</p>';
            }
            content.addEventListener('click', (e) => {
                const link = e.target && e.target.closest ? e.target.closest('a[href]') : null;
                if (link) e.preventDefault();
            });
            body.appendChild(content);

            const footer = document.createElement('div');
            footer.style.cssText =
                'display:flex;justify-content:flex-end;gap:8px;padding:12px 20px;border-top:1px solid #dee2e6;flex:0 0 auto;';
            const doneBtn = document.createElement('button');
            doneBtn.type = 'button';
            doneBtn.className = 'btn btn-white';
            doneBtn.textContent = 'Close';
            doneBtn.addEventListener('click', () => closePreviewOverlay(overlay));
            footer.appendChild(doneBtn);

            panel.appendChild(header);
            panel.appendChild(body);
            panel.appendChild(footer);
            overlay.appendChild(panel);

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closePreviewOverlay(overlay);
            });
            const onKey = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    closePreviewOverlay(overlay);
                }
            };
            document.addEventListener('keydown', onKey, true);
            overlay._rteCleanup = () => {
                document.removeEventListener('keydown', onKey, true);
                overlay._rteCleanup = null;
            };

            document.body.appendChild(overlay);
            doneBtn.focus();
        },
  } as any
);
