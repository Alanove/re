(function () {
  'use strict';

  if (!window.RichTextEditor || typeof window.RichTextEditor.mountTextarea !== 'function') {
    return;
  }

  var RTE = window.RichTextEditor;

  // Swatches come from the --color-* variables in admin.scss (sampled from the logo).
  RTE.SITE_COLOR_VARS = [
    '--color-primary',
    '--color-primary-dark',
    '--color-secondary',
    '--color-secondary-fixed',
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
    if (!form) return null;
    var fromData = form.getAttribute('data-page-key');
    if (fromData && fromData.trim() && fromData.trim() !== 'new-page') {
      return fromData.trim();
    }
    var input = form.querySelector('input[name="key"]');
    var value = input && input.value ? input.value.trim() : '';
    if (value && value !== 'new-page') return value;
    var match = window.location.pathname.match(/\/admin\/(?:pages|news|home)\/([^/]+)\/edit$/);
    if (match && match[1] && match[1] !== 'create') {
      try {
        return decodeURIComponent(match[1]);
      } catch (error) {
        return match[1];
      }
    }
    return null;
  }

  function mapImages(response) {
    return response && Array.isArray(response.images) ? response.images : [];
  }

  function mount(textarea) {
    var form = textarea.closest('form');
    var startInSource = textarea.getAttribute('data-editor-mode') === 'source';
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

    // custom.js reads editor HTML through textarea.customEditor.
    textarea.customEditor = {
      getHTML: function () {
        return editor.getHTML();
      }
    };

    // Home sections store raw HTML and open in source mode.
    if (startInSource && editor._core && typeof editor._core.setMode === 'function') {
      editor._core.setMode('source');
    }
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
