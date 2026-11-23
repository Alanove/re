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
    if (ta.customEditor && ta.customEditor.getHTML) {
      ta.value = ta.customEditor.getHTML();
    }
  }

  function initModalRichText(textareaId, initialHtml) {
    var ta = document.getElementById(textareaId);
    if (!ta) return null;
    ta.value = initialHtml || '';
    ta.setAttribute('data-editor-height', '220px');
    ta.dataset.rteMounted = '';
    if (window.AntonioRichText && typeof window.AntonioRichText.mount === 'function') {
      var mounted = window.AntonioRichText.mount(ta);
      if (mounted && mounted.setHTML) {
        mounted.setHTML(initialHtml || '');
      }
      return mounted;
    }
    return null;
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
    var layout = c.layout || 'default';
    return (
      '<form id="blockEditForm">' +
      '<div class="mb-3">' +
      '<label class="form-label">Layout</label>' +
      '<div class="form-check">' +
      '<input class="form-check-input" type="radio" name="blockLayout" id="layoutDefault" value="default"' +
      (layout !== 'couture_rail' ? ' checked' : '') +
      ' />' +
      '<label class="form-check-label" for="layoutDefault">Product grid</label>' +
      '</div>' +
      '<div class="form-check">' +
      '<input class="form-check-input" type="radio" name="blockLayout" id="layoutRail" value="couture_rail"' +
      (layout === 'couture_rail' ? ' checked' : '') +
      ' />' +
      '<label class="form-check-label" for="layoutRail">Couture rail (full-screen horizontal)</label>' +
      '</div>' +
      '</div>' +
      '<div class="mb-3">' +
      '<label class="form-label">Section title <span class="text-muted fw-normal">(optional — overlays the rail)</span></label>' +
      '<input type="text" class="form-control" id="blockTitle" value="' +
      escapeHtml(c.title || '') +
      '" placeholder="e.g. Couture" maxlength="80" />' +
      '</div>' +
      '<div class="mb-3">' +
      '<label class="form-label">Discover link</label>' +
      '<input type="text" class="form-control" id="blockDiscoverLink" value="' +
      escapeHtml(c.discoverLink || '') +
      '" placeholder="/shop/category/haute-couture" />' +
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
      '<input type="number" class="form-control" id="blockLimit" min="1" max="' +
      (layout === 'couture_rail' ? '24' : '12') +
      '" value="' +
      (c.limit || (layout === 'couture_rail' ? 12 : 4)) +
      '" />' +
      '<div class="form-text" id="blockLimitHint"' +
      (layout === 'couture_rail' ? '' : ' style="display:none"') +
      '>Couture carousel shows 4 images per page; use 8–24 products for multiple pages.</div>' +
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

  function mediaPreviewUrl(u) {
    if (!u) return '';
    var s = String(u).trim();
    if (s.indexOf('http') === 0 || s.indexOf('/') === 0) return s;
    return '/images/home-content/' + s;
  }

  function buildCategoryForm(block) {
    var c = block.config || {};
    var mode = c.displayMode || 'shop_the_look';
    var videoSrc = mediaPreviewUrl(c.videoUrl);
    var posterSrc = mediaPreviewUrl(c.videoPosterUrl);
    var videoPreview = videoSrc
      ? '<div class="mb-2"><video src="' +
        escapeHtml(videoSrc) +
        '" controls muted playsinline style="max-width:100%;max-height:180px"></video></div>'
      : '<p class="text-muted small mb-2">No homepage override — category video will be used.</p>';
    var posterPreview = posterSrc
      ? '<div class="mb-2"><img src="' +
        escapeHtml(posterSrc) +
        '" alt="" class="img-fluid rounded border" style="max-height:120px" /></div>'
      : '';
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
      '<input class="form-check-input" type="radio" name="blockDisplayMode" id="modeFullscreen" value="fullscreen"' +
      (mode === 'fullscreen' ? ' checked' : '') +
      ' />' +
      '<label class="form-check-label" for="modeFullscreen">Fullscreen section (image or video)</label>' +
      '</div>' +
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
      '<label class="form-check-label" for="modeVideo">Category with video (split layout)</label>' +
      '</div>' +
      '</div>' +
      '<div id="blockVideoFields"' +
      (mode === 'video' || mode === 'fullscreen' ? '' : ' style="display:none"') +
      '>' +
      '<p class="text-muted fs-12px mb-3">Optional: upload a homepage-only video. Leave empty to use the category video/image (Admin → Categories).</p>' +
      '<div class="mb-3">' +
      '<label class="form-label">Homepage video (optional)</label>' +
      videoPreview +
      '<input type="file" class="form-control" id="blockVideoFile" name="block_video" accept="video/mp4,video/webm,video/*" />' +
      (videoSrc
        ? '<div class="form-check mt-2"><input class="form-check-input" type="checkbox" id="removeBlockVideo" /><label class="form-check-label" for="removeBlockVideo">Remove homepage video (use category)</label></div>'
        : '') +
      '</div>' +
      '<div class="mb-3">' +
      '<label class="form-label">Video poster (optional)</label>' +
      posterPreview +
      '<input type="file" class="form-control" id="blockVideoPosterFile" name="block_video_poster" accept="image/*" />' +
      (posterSrc
        ? '<div class="form-check mt-2"><input class="form-check-input" type="checkbox" id="removeBlockVideoPoster" /><label class="form-check-label" for="removeBlockVideoPoster">Remove homepage poster</label></div>'
        : '') +
      '</div>' +
      '<div class="mb-3" id="blockIntroWrap"' +
      (mode === 'video' ? '' : ' style="display:none"') +
      '>' +
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
      modalBody.querySelectorAll('input[name="blockLayout"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
          var hint = document.getElementById('blockLimitHint');
          if (hint) hint.style.display = radio.value === 'couture_rail' ? '' : 'none';
        });
      });
    } else if (block.type === 'category_display') {
      modalBody.innerHTML = buildCategoryForm(block);
      modalBody.querySelectorAll('input[name="blockDisplayMode"]').forEach(function (radio) {
        radio.addEventListener('change', function () {
          var wrap = document.getElementById('blockVideoFields');
          var introWrap = document.getElementById('blockIntroWrap');
          var needsMedia = radio.value === 'video' || radio.value === 'fullscreen';
          if (wrap) wrap.style.display = needsMedia ? '' : 'none';
          if (introWrap) introWrap.style.display = radio.value === 'video' ? '' : 'none';
          if (radio.value === 'video' && !activeModalEditor) {
            activeModalEditor = initModalRichText(
              'blockIntroHtml',
              (block.config && block.config.introHtml) || ''
            );
          }
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
      var layoutEl = document.querySelector('input[name="blockLayout"]:checked');
      formData.append('title', document.getElementById('blockTitle').value);
      formData.append('discover_link', document.getElementById('blockDiscoverLink').value);
      formData.append('source', sourceEl ? sourceEl.value : 'new_arrivals');
      formData.append('category_id', document.getElementById('blockCategoryId').value);
      formData.append('limit', document.getElementById('blockLimit').value);
      formData.append('layout', layoutEl ? layoutEl.value : 'default');
    } else if (block.type === 'category_display') {
      var modeEl = document.querySelector('input[name="blockDisplayMode"]:checked');
      var modeVal = modeEl ? modeEl.value : 'fullscreen';
      formData.append('category_id', document.getElementById('blockCategoryId').value);
      formData.append('display_mode', modeVal);
      if (modeVal === 'video' || modeVal === 'fullscreen') {
        if (modeVal === 'video') {
          var introHtml = '';
          if (activeModalEditor && activeModalEditor.getHTML) {
            introHtml = activeModalEditor.getHTML();
          } else {
            var introEl = document.getElementById('blockIntroHtml');
            introHtml = introEl ? introEl.value : '';
          }
          formData.append('intro_html', introHtml);
        }
        var videoFileEl = document.getElementById('blockVideoFile');
        if (videoFileEl && videoFileEl.files && videoFileEl.files[0]) {
          formData.append('block_video', videoFileEl.files[0]);
        }
        var posterFileEl = document.getElementById('blockVideoPosterFile');
        if (posterFileEl && posterFileEl.files && posterFileEl.files[0]) {
          formData.append('block_video_poster', posterFileEl.files[0]);
        }
        var removeVideoEl = document.getElementById('removeBlockVideo');
        if (removeVideoEl && removeVideoEl.checked) {
          formData.append('remove_block_video', '1');
        }
        var removePosterEl = document.getElementById('removeBlockVideoPoster');
        if (removePosterEl && removePosterEl.checked) {
          formData.append('remove_block_video_poster', '1');
        }
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
