(function () {
  'use strict';

  if (!window.RichTextEditor || typeof window.RichTextEditor.mountTextarea !== 'function') {
    return;
  }

  var RTE = window.RichTextEditor;

  // Swatches come from the --color-* variables emitted by public/scss/_tokens.scss.
  RTE.SITE_COLOR_VARS = [
    '--color-primary',
    '--color-primary-dark',
    '--color-primary-container',
    '--color-secondary',
    '--color-secondary-fixed',
    '--color-industrial-gold',
    '--color-on-surface',
    '--color-slate-gray',
    '--color-surface-low',
    '--color-surface-high',
    '--color-white'
  ];

  function csrfToken() {
    var meta = document.querySelector('meta[name="csrf-token"]');
    return meta ? meta.getAttribute('content') || '' : '';
  }

  function pageKeyFor(form) {
    var input = form ? form.querySelector('input[name="key"]') : null;
    var value = input ? input.value.trim() : '';
    return value && value !== 'new-page' ? value : null;
  }

  function pageIdFor(form) {
    var value = form && form.dataset ? form.dataset.pageId : '';
    return value ? value : null;
  }

  function mapImages(response) {
    return response && Array.isArray(response.images) ? response.images : [];
  }

  function mount(textarea) {
    var form = textarea.closest('form');
    var editor = RTE.mountTextarea(textarea, {
      height: textarea.getAttribute('data-editor-height') || '480px',
      templatesUrl: '/admin/editor/templates.json',
      iconsBaseUrl: '/admin/editor/icons/',
      fileManager: {
        pageListUrl: '/admin/api/page-images',
        libraryListUrl: '/admin/api/public-images',
        uploadUrl: '/admin/api/upload-image',
        uploadFieldName: 'image',
        pageKeyField: 'pageKey',
        csrfHeader: 'X-CSRF-Token',
        csrfField: '_csrf',
        getCsrfToken: csrfToken,
        getPageKey: function () {
          return pageKeyFor(form);
        },
        getPageId: function () {
          return pageIdFor(form);
        },
        mapList: mapImages,
        mapUpload: function (response) {
          return { url: response.url, name: response.name };
        },
        documentUploadUrl: function (pageKey) {
          return '/admin/pages/' + encodeURIComponent(pageKey) + '/upload-file';
        },
        documentFieldName: 'file',
        mapDocumentUpload: function (response) {
          return { url: response.filePath, name: response.originalName };
        }
      }
    });

    // custom.js (shared CMS script) reads editor HTML through textarea.customEditor.
    textarea.customEditor = {
      getHTML: function () {
        return editor.getHTML();
      }
    };
  }

  function init() {
    document.querySelectorAll('textarea.rich-text').forEach(mount);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
