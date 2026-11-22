(function () {
  'use strict';

  if (!window.RichTextEditor || typeof window.RichTextEditor.mountTextarea !== 'function') {
    return;
  }

  var RTE = window.RichTextEditor;

  RTE.SITE_COLOR_VARS = [
    '--color-primary',
    '--color-primary-dark',
    '--color-secondary',
    '--color-on-surface',
    '--color-surface',
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

  function resolveHeight(textarea) {
    var fromTextarea = textarea.getAttribute('data-editor-height') || textarea.getAttribute('data-rich-text-height');
    if (fromTextarea) return fromTextarea;
    var form = textarea.closest('form');
    var fromForm = form && form.getAttribute('data-rich-text-editor-height');
    if (fromForm) return fromForm;
    if (textarea.classList.contains('rich-text-compact')) return '120px';
    return '480px';
  }

  function mount(textarea) {
    if (!textarea || textarea.dataset.rteMounted === '1') {
      return textarea && textarea.customEditor ? textarea.customEditor : null;
    }

    var form = textarea.closest('form');
    var editor = RTE.mountTextarea(textarea, {
      height: resolveHeight(textarea),
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

    textarea.dataset.rteMounted = '1';
    textarea.customEditor = {
      getHTML: function () {
        return editor.getHTML();
      },
      setHTML: function (html) {
        if (typeof editor.setHTML === 'function') {
          editor.setHTML(html);
        } else if (typeof RTE.setOnTextarea === 'function') {
          RTE.setOnTextarea(textarea, html || '');
        } else {
          textarea.value = html || '';
        }
      }
    };
    return textarea.customEditor;
  }

  function init() {
    document.querySelectorAll('textarea.rich-text').forEach(mount);
  }

  window.AntonioRichText = {
    mount: mount,
    init: init
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
