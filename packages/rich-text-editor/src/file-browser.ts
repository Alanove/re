// @ts-nocheck
/**
 * RichTextEditor mixin — file-browser.ts
 * Page images, library images and uploads, all driven by options.fileManager.
 */
import { RichTextEditorCore } from './core';

Object.assign(
  RichTextEditorCore.prototype,
  {

        getTemplatesUrl() {
            return this.options.templatesUrl || '/admin/editor/templates.json';
        },

        getFileManager() {
            return this.options.fileManager || {};
        },

        getCsrfHeaders() {
            const fm = this.getFileManager();
            const headers = {};
            const token = typeof fm.getCsrfToken === 'function' ? fm.getCsrfToken() : '';
            if (token && fm.csrfHeader) {
                headers[fm.csrfHeader] = token;
            }
            return headers;
        },

        /** Current page key from fileManager.getPageKey, or '' when the page is not saved yet. */
        getPageKey() {
            const fm = this.getFileManager();
            if (typeof fm.getPageKey === 'function') {
                const key = fm.getPageKey();
                return key ? String(key) : '';
            }
            return '';
        },

        /** Current page id from fileManager.getPageId, or null. */
        getPageId() {
            const fm = this.getFileManager();
            if (typeof fm.getPageId === 'function') {
                const parsed = parseInt(fm.getPageId(), 10);
                if (Number.isFinite(parsed) && parsed > 0) {
                    return parsed;
                }
            }
            return null;
        },

        /** True when Page Images can be listed for this editor. */
        hasPageImages() {
            return !!this.getFileManager().pageListUrl;
        },

        /**
         * List images for one source.
         * @param {'page'|'public'} source
         * @returns {Promise<Array<{url:string,name:string,size?:number}>>}
         */
        async fileManagerList(source) {
            const fm = this.getFileManager();
            const isPage = source === 'page';
            const base = isPage ? fm.pageListUrl : fm.libraryListUrl;
            if (!base) {
                return [];
            }
            const url = new URL(base, window.location.origin);
            if (isPage) {
                const pageKey = this.getPageKey();
                const pageId = this.getPageId();
                if (pageKey) url.searchParams.set('pageKey', pageKey);
                if (pageId != null) url.searchParams.set('pageId', String(pageId));
            }
            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: this.getCsrfHeaders(),
                credentials: 'same-origin'
            });
            if (!response.ok) {
                throw new Error('Could not load images (HTTP ' + response.status + ').');
            }
            const data = await response.json();
            return typeof fm.mapList === 'function' ? fm.mapList(data) : (data.files || []);
        },

        /**
         * Upload an image (default) or a linked document.
         * @param {File} file
         * @param {'image'|'document'} [kind]
         */
        async fileManagerUpload(file, kind) {
            const fm = this.getFileManager();
            const isDocument = kind === 'document';
            const pageKey = this.getPageKey() || 'generic';
            let target = isDocument ? fm.documentUploadUrl : fm.uploadUrl;
            if (typeof target === 'function') {
                target = target(pageKey);
            }
            if (!target) {
                throw new Error((isDocument ? 'File' : 'Image') + ' upload is not configured for this editor.');
            }
            const formData = new FormData();
            formData.append(
                isDocument ? (fm.documentFieldName || 'file') : (fm.uploadFieldName || 'file'),
                file
            );
            if (fm.pageKeyField) {
                formData.append(fm.pageKeyField, pageKey);
            }
            const token = typeof fm.getCsrfToken === 'function' ? fm.getCsrfToken() : '';
            if (token && fm.csrfField) {
                formData.append(fm.csrfField, token);
            }
            const response = await fetch(new URL(target, window.location.origin).toString(), {
                method: 'POST',
                headers: this.getCsrfHeaders(),
                body: formData,
                credentials: 'same-origin'
            });
            const raw = await response.text();
            let data = null;
            try {
                data = raw ? JSON.parse(raw) : null;
            } catch (parseErr) {
                throw new Error(
                    response.ok
                        ? 'Unexpected server response.'
                        : 'Upload failed (HTTP ' + response.status + ').'
                );
            }
            if (!response.ok) {
                throw new Error(
                    (data && (data.message || data.error)) || ('Upload failed (HTTP ' + response.status + ').')
                );
            }
            if (!data || !data.success) {
                throw new Error((data && (data.message || data.error)) || 'Upload failed');
            }
            const map = isDocument ? fm.mapDocumentUpload : fm.mapUpload;
            return typeof map === 'function' ? map(data) : data;
        },

        formatFileSize(bytes) {
            if (!bytes) return '';
            const k = 1024;
            const sizes = ['Bytes', 'KB', 'MB', 'GB'];
            const i = Math.floor(Math.log(bytes) / Math.log(k));
            return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        }
  } as any
);
