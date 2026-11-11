(function () {
  'use strict';

  function initHomePageBuilder() {
  var cfg = window.HOME_PAGE_BUILDER || {};
  var csrfToken = cfg.csrfToken || '';
  var categories = cfg.categories || [];
  var blocksById = {};

  (cfg.blocks || []).forEach(function (b) {
    blocksById[b.id] = b;
    blocksById[String(b.id)] = b;
  });

  var listEl = document.getElementById('homeBlocksList');
  var modalEl = document.getElementById('editBlockModal');
  var modalBody = document.getElementById('editBlockModalBody');
  var modalTitle = document.getElementById('editBlockModalTitle');
  var saveBlockBtn = document.getElementById('saveBlockBtn');
  var modalInstance = null;
  var activeBlockId = null;
  var activeModalEditor = null;

  function getModalInstance() {
    if (!modalEl) return null;
    if (!modalInstance && typeof bootstrap !== 'undefined') {
      modalInstance = new bootstrap.Modal(modalEl);
    }
    return modalInstance;
  }

  function getBlock(blockId) {
    return blocksById[blockId] || blocksById[String(blockId)] || null;
  }

  function categoryOptions(selectedId) {
    var html = '<option value="">— Select category —</option>';
    categories.forEach(function (c) {
      var sel = selectedId && Number(selectedId) === c.id ? ' selected' : '';
      html += '<option value="' + c.id + '"' + sel + '>' + escapeHtml(c.label) + '</option>';
    });
    return html;
  }

  function safeTextareaContent(str) {
    return String(str || '').replace(/<\/textarea>/gi, '&lt;/textarea&gt;');
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function syncRichTextFromEditor(textareaId) {
    var ta = document.getElementById(textareaId);
    if (!ta) return;
    var container = ta.parentNode.querySelector('.custom-editor-container');
    if (container && container.id && typeof initCustomEditor === 'function') {
      var editorInstance = window['__editor_' + container.id];
      if (editorInstance && editorInstance.getHTML) {
        ta.value = editorInstance.getHTML();
      }
    }
  }

  function initModalRichText(textareaId, initialHtml) {
    var ta = document.getElementById(textareaId);
    if (!ta || typeof initCustomEditor !== 'function') return null;

    var existing = ta.parentNode.querySelector('.custom-editor-container');
    if (existing) existing.remove();
    ta.style.display = 'none';
    ta.value = initialHtml || '';

    var editorContainer = document.createElement('div');
    editorContainer.id = 'block-modal-editor-' + textareaId;
    editorContainer.className = 'custom-editor-container';
    ta.parentNode.insertBefore(editorContainer, ta);

    var editor = initCustomEditor(editorContainer.id, {
      height: '220px',
      placeholder: '',
      initialContent: initialHtml || ''
    });
    window['__editor_' + editorContainer.id] = editor;
    return editor;
  }

  function buildTextForm(block) {
    var c = block.config || {};
    return (
      '<form id="blockEditForm">' +
      '<div class="mb-3">' +
      '<label class="form-label">Content</label>' +
      '<textarea id="blockHtmlField" class="form-control rich-text" rows="8">' +
      safeTextareaContent(c.html || '') +
      '</textarea>' +
      '</div>' +
      '<div class="mb-0">' +
      '<label class="form-label">Style</label>' +
      '<select class="form-select" name="style" id="blockTextStyle">' +
      '<option value="default"' +
      (c.style !== 'la_maison' ? ' selected' : '') +
      '>Tagline (below hero)</option>' +
      '<option value="la_maison"' +
      (c.style === 'la_maison' ? ' selected' : '') +
      '>La Maison section</option>' +
      '</select>' +
      '</div>' +
      '<div class="form-check mt-3">' +
      '<input class="form-check-input" type="checkbox" id="blockEnabled" ' +
      (block.isEnabled ? 'checked' : '') +
      ' />' +
      '<label class="form-check-label" for="blockEnabled">Visible on homepage</label>' +
      '</div>' +
      '</form>'
    );
  }

  function buildProductsForm(block) {
    var c = block.config || {};
    var source = c.source || 'new_arrivals';
    return (
      '<form id="blockEditForm">' +
      '<div class="mb-3">' +
      '<label class="form-label">Section title</label>' +
      '<input type="text" class="form-control" id="blockTitle" value="' +
      escapeHtml(c.title || '') +
      '" />' +
      '</div>' +
      '<div class="mb-3">' +
      '<label class="form-label">Discover link</label>' +
      '<input type="text" class="form-control" id="blockDiscoverLink" value="' +
      escapeHtml(c.discoverLink || '') +
      '" placeholder="/shop?new_arrival=true" />' +
      '</div>' +
      '<div class="mb-3">' +
      '<label class="form-label">Product source</label>' +
      '<div class="form-check">' +
      '<input class="form-check-input" type="radio" name="blockSource" id="srcNew" value="new_arrivals"' +
      (source === 'new_arrivals' ? ' checked' : '') +
      ' />' +
      '<label class="form-check-label" for="srcNew">New Arrivals</label>' +
      '</div>' +
      '<div class="form-check">' +
      '<input class="form-check-input" type="radio" name="blockSource" id="srcFeatured" value="featured"' +
      (source === 'featured' ? ' checked' : '') +
      ' />' +
      '<label class="form-check-label" for="srcFeatured">Featured</label>' +
      '</div>' +
      '<div class="form-check">' +
      '<input class="form-check-input" type="radio" name="blockSource" id="srcCategory" value="category"' +
      (source === 'category' ? ' checked' : '') +
      ' />' +
      '<label class="form-check-label" for="srcCategory">Category</label>' +
      '</div>' +
      '</div>' +
      '<div class="mb-3" id="blockCategoryWrap"' +
      (source === 'category' ? '' : ' style="display:none"') +
      '>' +
      '<label class="form-label">Category</label>' +
      '<select class="form-select" id="blockCategoryId">' +
      categoryOptions(c.categoryId) +
      '</select>' +
      '</div>' +
      '<div class="mb-3">' +
      '<label class="form-label">Products to show</label>' +
      '<input type="number" class="form-control" id="blockLimit" min="1" max="12" value="' +
      (c.limit || 4) +
      '" />' +
      '</div>' +
      '<div class="form-check">' +
      '<input class="form-check-input" type="checkbox" id="blockEnabled" ' +
      (block.isEnabled ? 'checked' : '') +
      ' />' +
      '<label class="form-check-label" for="blockEnabled">Visible on homepage</label>' +
      '</div>' +
      '</form>'
    );
  }

  function buildCategoryForm(block) {
    var c = block.config || {};
    var mode = c.displayMode || 'shop_the_look';
    return (
      '<form id="blockEditForm" enctype="multipart/form-data">' +
      '<div class="mb-3">' +
      '<label class="form-label">Category</label>' +
      '<select class="form-select" id="blockCategoryId">' +
      categoryOptions(c.categoryId) +
      '</select>' +
      '</div>' +
      '<div class="mb-3">' +
      '<label class="form-label">Display mode</label>' +
      '<div class="form-check">' +
      '<input class="form-check-input" type="radio" name="blockDisplayMode" id="modeStl" value="shop_the_look"' +
      (mode === 'shop_the_look' ? ' checked' : '') +
      ' />' +
      '<label class="form-check-label" for="modeStl">Shop The Look</label>' +
      '</div>' +
      '<div class="form-check">' +
      '<input class="form-check-input" type="radio" name="blockDisplayMode" id="modeVideo" value="video"' +
      (mode === 'video' ? ' checked' : '') +
      ' />' +
      '<label class="form-check-label" for="modeVideo">Category with video</label>' +
      '</div>' +
      '</div>' +
      '<div id="blockVideoFields"' +
      (mode === 'video' ? '' : ' style="display:none"') +
      '>' +
      '<p class="text-muted fs-12px mb-3">Video and poster are taken from the selected category (Admin → Categories → edit category → video upload). Parent categories are used when the category has no video.</p>' +
      '<div class="mb-3">' +
      '<label class="form-label">Intro text</label>' +
      '<textarea id="blockIntroHtml" class="form-control rich-text" rows="6">' +
      safeTextareaContent(c.introHtml || '') +
      '</textarea>' +
      '</div>' +
      '</div>' +
      '<div class="form-check mt-2">' +
      '<input class="form-check-input" type="checkbox" id="blockEnabled" ' +
      (block.isEnabled ? 'checked' : '') +
      ' />' +
      '<label class="form-check-label" for="blockEnabled">Visible on homepage</label>' +
      '</div>' +
      '</form>'
    );
  }

  function openEditModal(blockId) {
    var block = getBlock(blockId);
    if (!block || !modalBody) return;
    activeBlockId = blockId;
    activeModalEditor = null;
    modalTitle.textContent = 'Edit — ' + (block.label || block.type);

    if (block.type === 'text') {
      modalBody.innerHTML = buildTextForm(block);
      activeModalEditor = initModalRichText('blockHtmlField', (block.config && block.config.html) || '');
    } else if (block.type === 'products_list') {
      modalBody.innerHTML = buildProductsForm(block);
      modalBody.querySelectorAll('input[name="blockSource"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
          var wrap = document.getElementById('blockCategoryWrap');
          if (wrap) wrap.style.display = radio.value === 'category' ? '' : 'none';
        });
      });
    } else if (block.type === 'category_display') {
      modalBody.innerHTML = buildCategoryForm(block);
      modalBody.querySelectorAll('input[name="blockDisplayMode"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
          var wrap = document.getElementById('blockVideoFields');
          if (wrap) wrap.style.display = radio.value === 'video' ? '' : 'none';
        });
      });
      if ((block.config && block.config.displayMode) === 'video') {
        activeModalEditor = initModalRichText('blockIntroHtml', (block.config && block.config.introHtml) || '');
      }
    }

    var modal = getModalInstance();
    if (modal) {
      modal.show();
    } else {
      console.error('Bootstrap modal unavailable — could not open editor.');
    }
  }

  async function saveActiveBlock() {
    if (!activeBlockId) return;
    var block = getBlock(activeBlockId);
    if (!block) return;

    var enabledEl = document.getElementById('blockEnabled');
    var isEnabled = enabledEl ? (enabledEl.checked ? '1' : '0') : '1';

    var formData = new FormData();
    formData.append('_csrf', csrfToken);
    formData.append('is_enabled', isEnabled);

    if (block.type === 'text') {
      if (activeModalEditor && activeModalEditor.getHTML) {
        formData.append('html', activeModalEditor.getHTML());
      } else {
        formData.append('html', document.getElementById('blockHtmlField').value);
      }
      formData.append('style', document.getElementById('blockTextStyle').value);
    } else if (block.type === 'products_list') {
      var sourceEl = document.querySelector('input[name="blockSource"]:checked');
      formData.append('title', document.getElementById('blockTitle').value);
      formData.append('discover_link', document.getElementById('blockDiscoverLink').value);
      formData.append('source', sourceEl ? sourceEl.value : 'new_arrivals');
      formData.append('category_id', document.getElementById('blockCategoryId').value);
      formData.append('limit', document.getElementById('blockLimit').value);
    } else if (block.type === 'category_display') {
      var modeEl = document.querySelector('input[name="blockDisplayMode"]:checked');
      formData.append('category_id', document.getElementById('blockCategoryId').value);
      formData.append('display_mode', modeEl ? modeEl.value : 'shop_the_look');
      if (modeEl && modeEl.value === 'video') {
        var introHtml = '';
        if (activeModalEditor && activeModalEditor.getHTML) {
          introHtml = activeModalEditor.getHTML();
        } else {
          var introEl = document.getElementById('blockIntroHtml');
          introHtml = introEl ? introEl.value : '';
        }
        formData.append('intro_html', introHtml);
      }
    }

    saveBlockBtn.disabled = true;
    try {
      var res = await fetch('/admin/home-content/blocks/' + activeBlockId + '/update', {
        method: 'POST',
        body: formData
      });
      var data = await res.json();
      if (data.success) {
        window.location.reload();
      } else {
        alert(data.message || 'Could not save block.');
      }
    } catch (e) {
      console.error(e);
      alert('Error saving block.');
    } finally {
      saveBlockBtn.disabled = false;
    }
  }

  async function createBlock(type) {
    try {
      var body = new URLSearchParams();
      body.append('_csrf', csrfToken);
      body.append('type', type);
      var res = await fetch('/admin/home-content/blocks/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
      var data = await res.json();
      if (data.success && data.id) {
        window.location.href = '/admin/home-content?edit=' + data.id;
        return;
      }
      alert(data.message || 'Could not add component.');
    } catch (e) {
      console.error(e);
      alert('Error adding component.');
    }
  }

  async function deleteBlock(blockId) {
    if (!confirm('Delete this component?')) return;
    try {
      var body = new URLSearchParams();
      body.append('_csrf', csrfToken);
      var res = await fetch('/admin/home-content/blocks/' + blockId + '/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
      var data = await res.json();
      if (data.success) {
        window.location.reload();
      } else {
        alert(data.message || 'Could not delete block.');
      }
    } catch (e) {
      console.error(e);
      alert('Error deleting block.');
    }
  }

  async function saveOrder() {
    if (!listEl) return;
    var ids = [];
    listEl.querySelectorAll('[data-block-id]').forEach(function (el) {
      ids.push(parseInt(el.getAttribute('data-block-id'), 10));
    });
    try {
      var body = new URLSearchParams();
      body.append('_csrf', csrfToken);
      body.append('orderedIds', JSON.stringify(ids));
      await fetch('/admin/home-content/blocks/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      });
    } catch (e) {
      console.error('Reorder failed', e);
    }
  }

  function bindListEvents() {
    if (!listEl) return;

    listEl.addEventListener('click', function (e) {
      var editBtn = e.target.closest('.edit-block-btn');
      if (editBtn) {
        e.preventDefault();
        openEditModal(parseInt(editBtn.getAttribute('data-block-id'), 10));
        return;
      }
      var delBtn = e.target.closest('.delete-block-btn');
      if (delBtn) {
        e.preventDefault();
        deleteBlock(parseInt(delBtn.getAttribute('data-block-id'), 10));
      }
    });

    if (typeof Sortable !== 'undefined') {
      Sortable.create(listEl, {
        handle: '.block-drag-handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        onEnd: function () {
          saveOrder();
        }
      });
    }
  }

  document.querySelectorAll('.add-block-btn').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      createBlock(btn.getAttribute('data-block-type'));
    });
  });

  if (saveBlockBtn) {
    saveBlockBtn.addEventListener('click', saveActiveBlock);
  }

  bindListEvents();

  var params = new URLSearchParams(window.location.search);
  var editId = params.get('edit');
  if (editId && getBlock(parseInt(editId, 10))) {
    openEditModal(parseInt(editId, 10));
    params.delete('edit');
    var clean = window.location.pathname + (params.toString() ? '?' + params.toString() : '');
    window.history.replaceState({}, '', clean);
  }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHomePageBuilder);
  } else {
    initHomePageBuilder();
  }
})();
