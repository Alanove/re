(function () {
  'use strict';

  var csrfMeta = document.querySelector('meta[name="csrf-token"]');
  var csrfToken = csrfMeta ? csrfMeta.getAttribute('content') : '';

  // Attach the session CSRF token to every same-origin state-changing fetch (custom.js and the editor call fetch directly).
  if (window.fetch && csrfToken) {
    var nativeFetch = window.fetch.bind(window);
    window.fetch = function (input, init) {
      var options = init ? Object.assign({}, init) : {};
      var method = (options.method || (input && input.method) || 'GET').toUpperCase();
      var url = typeof input === 'string' ? input : input && input.url ? input.url : '';
      var sameOrigin = !/^https?:\/\//i.test(url) || url.indexOf(window.location.origin) === 0;
      if (sameOrigin && method !== 'GET' && method !== 'HEAD') {
        var headers = new Headers(options.headers || (input && input.headers) || {});
        if (!headers.has('X-CSRF-Token')) {
          headers.set('X-CSRF-Token', csrfToken);
        }
        if (!headers.has('Accept')) {
          headers.set('Accept', 'application/json');
        }
        options.headers = headers;
        options.credentials = options.credentials || 'same-origin';
      }
      return nativeFetch(input, options);
    };
  }

  function hideLoader() {
    var loader = document.getElementById('loader');
    if (loader) {
      loader.classList.add('loaded');
    }
  }

  function toast(message, type) {
    if (typeof window.showToast === 'function') {
      window.showToast({ message: message, type: type });
    } else {
      window.alert(message);
    }
  }

  function slugify(value) {
    return value
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  function initDeleteButtons() {
    document.addEventListener('click', function (event) {
      var button = event.target.closest('[data-delete-url]');
      if (!button) {
        return;
      }
      event.preventDefault();
      if (typeof window.showActionModal !== 'function') {
        return;
      }
      var title = button.getAttribute('data-delete-title') || 'Delete';
      window.showActionModal({
        title: title,
        message: button.getAttribute('data-delete-message') || 'Are you sure?',
        endpoint: button.getAttribute('data-delete-url'),
        method: 'DELETE',
        onSuccess: function (data) {
          if (!data || !data.success) {
            toast((data && data.message) || 'The item could not be deleted.', 'error');
            return;
          }
          var redirect = button.getAttribute('data-delete-redirect');
          if (redirect) {
            window.location.assign(redirect);
            return;
          }
          var row = button.closest('tr');
          if (row) {
            row.remove();
          }
          toast(data.message || 'Deleted.', 'success');
        }
      });
    });
  }

  function initToastClose() {
    document.addEventListener('click', function (event) {
      var container = document.getElementById('toast-container');
      if (!container || !container.contains(event.target)) {
        return;
      }
      var button = event.target.closest('button');
      if (button && button.parentElement && button.parentElement.parentElement) {
        button.parentElement.parentElement.remove();
      }
    });
  }

  function initTableFilters() {
    document.querySelectorAll('[data-table-filter]').forEach(function (input) {
      var table = document.querySelector(input.getAttribute('data-table-filter'));
      if (!table) {
        return;
      }
      input.addEventListener('input', function () {
        var term = input.value.trim().toLowerCase();
        table.querySelectorAll('tbody tr[data-filter-text]').forEach(function (row) {
          row.hidden = term !== '' && row.getAttribute('data-filter-text').indexOf(term) === -1;
        });
      });
    });
  }

  function initSlugSources() {
    document.querySelectorAll('[data-slug-source]').forEach(function (source) {
      var target = document.querySelector(source.getAttribute('data-slug-source'));
      if (!target) {
        return;
      }
      var auto = target.value.trim() === '';
      target.addEventListener('input', function () {
        auto = target.value.trim() === '';
      });
      source.addEventListener('input', function () {
        if (auto) {
          target.value = slugify(source.value);
          target.dispatchEvent(new Event('change'));
        }
      });
    });
  }

  function initSlugCheck() {
    var form = document.getElementById('page-form');
    if (!form) {
      return;
    }
    var slug = form.querySelector('#slug');
    var parent = form.querySelector('#parentId');
    var status = form.querySelector('[data-slug-status]');
    var endpoint = form.getAttribute('data-slug-check');
    var pageId = form.getAttribute('data-page-id');
    var timer = null;
    function check() {
      var value = slug.value.trim().toLowerCase();
      if (!value) {
        status.textContent = '';
        return;
      }
      var params = new URLSearchParams({ slug: value });
      if (parent.value) {
        params.set('parentId', parent.value);
      }
      if (pageId) {
        params.set('excludeId', pageId);
      }
      fetch(endpoint + '?' + params.toString(), { headers: { Accept: 'application/json' } })
        .then(function (response) {
          return response.json();
        })
        .then(function (data) {
          if (!data.success) {
            status.className = 'small mt-1 text-danger';
            status.textContent = 'Use lowercase letters, numbers, dashes or underscores.';
            return;
          }
          status.className = 'small mt-1 ' + (data.available ? 'text-success' : 'text-danger');
          status.textContent = data.available ? 'This address is available.' : 'Another page under this parent already uses this slug.';
        })
        .catch(function () {
          status.textContent = '';
        });
    }
    function schedule() {
      window.clearTimeout(timer);
      timer = window.setTimeout(check, 300);
    }
    slug.addEventListener('input', schedule);
    slug.addEventListener('change', schedule);
    parent.addEventListener('change', schedule);
  }

  var MAX_PREVIEW_FILES = 12;

  function previewFor(input) {
    return document.querySelector('[data-image-preview="#' + window.CSS.escape(input.id) + '"]');
  }

  function rememberPreview(preview) {
    if (preview && !preview.hasAttribute('data-original-html')) {
      preview.setAttribute('data-original-html', preview.innerHTML);
    }
  }

  function restorePreview(preview) {
    if (preview && preview.hasAttribute('data-original-html')) {
      preview.innerHTML = preview.getAttribute('data-original-html');
    }
  }

  function selectionLabel(input) {
    var files = input.files || [];
    if (files.length === 0) {
      return '';
    }
    return files.length === 1 ? files[0].name : files.length + ' files selected';
  }

  function initFileBrowse() {
    document.addEventListener('click', function (event) {
      var browse = event.target.closest('[data-file-browse]');
      if (browse) {
        var input = document.getElementById(browse.getAttribute('data-file-browse'));
        if (input) {
          input.click();
        }
        return;
      }
      var clear = event.target.closest('[data-file-clear]');
      if (clear) {
        var target = document.getElementById(clear.getAttribute('data-file-clear'));
        if (target) {
          target.value = '';
          target.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    });
    document.addEventListener('change', function (event) {
      var input = event.target;
      if (!input || input.type !== 'file' || !input.id) {
        return;
      }
      var label = document.getElementById(input.id + 'Label');
      var clear = document.querySelector('[data-file-clear="' + window.CSS.escape(input.id) + '"]');
      var chosen = selectionLabel(input);
      if (label) {
        label.value = chosen || label.getAttribute('data-current-name') || '';
      }
      if (clear) {
        clear.hidden = chosen === '';
      }
    });
    document.addEventListener('change', function (event) {
      var box = event.target;
      if (!box || !box.matches || !box.matches('[data-media-remove]')) {
        return;
      }
      var picker = box.closest('[data-media-picker]');
      if (!picker) {
        return;
      }
      var hidden = picker.querySelector('[data-media-value]');
      if (hidden && !box.name) {
        if (!hidden.hasAttribute('data-original-value')) {
          hidden.setAttribute('data-original-value', hidden.value);
        }
        hidden.value = box.checked ? '' : hidden.getAttribute('data-original-value');
      }
      picker.classList.toggle('is-removing', box.checked);
    });
    document.addEventListener(
      'error',
      function (event) {
        var img = event.target;
        if (img && img.tagName === 'IMG' && img.hasAttribute('data-fallback-src')) {
          var fallback = img.getAttribute('data-fallback-src');
          img.removeAttribute('data-fallback-src');
          img.src = fallback;
        }
      },
      true
    );
  }

  function initImagePreviews() {
    document.addEventListener('change', function (event) {
      var input = event.target;
      if (!input || input.type !== 'file' || !input.id) {
        return;
      }
      var preview = previewFor(input);
      if (!preview) {
        return;
      }
      rememberPreview(preview);
      var files = Array.prototype.filter.call(input.files || [], function (file) {
        return file.type.indexOf('image/') === 0;
      });
      if (files.length === 0) {
        restorePreview(preview);
        return;
      }
      preview.innerHTML = '';
      files.slice(0, MAX_PREVIEW_FILES).forEach(function (file) {
        var url = URL.createObjectURL(file);
        var img = document.createElement('img');
        img.src = url;
        img.alt = 'Preview of ' + file.name;
        img.onload = function () {
          URL.revokeObjectURL(url);
        };
        preview.appendChild(img);
      });
      if (files.length > MAX_PREVIEW_FILES) {
        var more = document.createElement('span');
        more.className = 'admin-image-preview__more';
        more.textContent = '+' + (files.length - MAX_PREVIEW_FILES);
        preview.appendChild(more);
      }
    });
  }

  function initHeroSlides() {
    var list = document.querySelector('[data-hero-slides]');
    var template = document.getElementById('hero-slide-template');
    if (!list || !template || !template.content.firstElementChild) {
      return;
    }
    var max = Number(list.getAttribute('data-max')) || 6;
    var addButton = document.querySelector('[data-hero-add]');
    var count = document.querySelector('[data-hero-count]');
    var empty = document.querySelector('[data-hero-empty]');
    var form = list.closest('form');
    var dragSlide = null;

    function slides() {
      return Array.prototype.filter.call(list.children, function (node) {
        return node.nodeType === 1 && node.hasAttribute('data-hero-slide');
      });
    }

    function replaceIndex(value, index) {
      return String(value)
        .replace(/slides\[\d+\]/g, 'slides[' + index + ']')
        .replace(/slide-\d+-/g, 'slide-' + index + '-')
        .replace(/slideImageFile\d+/g, 'slideImageFile' + index)
        .replace(/slideVideoFile\d+/g, 'slideVideoFile' + index)
        .replace(/itemImageFile\d+/g, 'itemImageFile' + index);
    }

    function refresh() {
      var items = slides();
      items.forEach(function (slide, index) {
        slide.querySelectorAll('[name]').forEach(function (field) {
          field.name = replaceIndex(field.name, index);
        });
        slide.querySelectorAll('[id]').forEach(function (field) {
          field.id = replaceIndex(field.id, index);
        });
        slide.querySelectorAll('[for]').forEach(function (field) {
          field.htmlFor = replaceIndex(field.htmlFor, index);
        });
        slide.querySelectorAll('[data-image-preview]').forEach(function (field) {
          field.setAttribute('data-image-preview', replaceIndex(field.getAttribute('data-image-preview'), index));
        });
        slide.querySelectorAll('[data-file-browse]').forEach(function (field) {
          field.setAttribute('data-file-browse', replaceIndex(field.getAttribute('data-file-browse'), index));
        });
        slide.querySelectorAll('[data-file-clear]').forEach(function (field) {
          field.setAttribute('data-file-clear', replaceIndex(field.getAttribute('data-file-clear'), index));
        });
        slide.querySelectorAll('[aria-labelledby]').forEach(function (field) {
          field.setAttribute('aria-labelledby', replaceIndex(field.getAttribute('aria-labelledby'), index));
        });
        slide.querySelectorAll('[data-indexed-label]').forEach(function (field) {
          field.setAttribute('aria-label', 'Slide ' + (index + 1) + ' ' + field.getAttribute('data-indexed-label'));
        });
        var label = slide.querySelector('[data-slide-label]');
        if (label) {
          label.textContent = 'Slide ' + (index + 1);
        }
        var up = slide.querySelector('[data-slide-up]');
        var down = slide.querySelector('[data-slide-down]');
        var remove = slide.querySelector('[data-slide-remove]');
        var handle = slide.querySelector('[data-slide-handle]');
        if (up) {
          up.disabled = index === 0;
          up.setAttribute('aria-label', 'Move slide ' + (index + 1) + ' up');
        }
        if (down) {
          down.disabled = index === items.length - 1;
          down.setAttribute('aria-label', 'Move slide ' + (index + 1) + ' down');
        }
        if (remove) {
          remove.setAttribute('aria-label', 'Remove slide ' + (index + 1));
        }
        if (handle) {
          handle.setAttribute('aria-label', 'Drag to reorder slide ' + (index + 1));
        }
      });
      if (addButton) {
        addButton.disabled = items.length >= max;
      }
      if (count) {
        count.textContent = items.length + ' of ' + max + ' slides';
      }
      if (empty) {
        empty.hidden = items.length > 0;
      }
    }

    function slideHasContent(slide) {
      var fields = slide.querySelectorAll('input, textarea, select');
      for (var i = 0; i < fields.length; i += 1) {
        var field = fields[i];
        if (field.type === 'file') {
          if (field.files && field.files.length) {
            return true;
          }
          continue;
        }
        if (field.type === 'checkbox' || field.type === 'radio') {
          if (field.checked) {
            return true;
          }
          continue;
        }
        if (field.value && field.value.trim()) {
          return true;
        }
      }
      return false;
    }

    function moveSlide(slide, direction) {
      var sibling = direction < 0 ? slide.previousElementSibling : slide.nextElementSibling;
      if (!sibling || !sibling.hasAttribute('data-hero-slide')) {
        return;
      }
      if (direction < 0) {
        list.insertBefore(slide, sibling);
      } else {
        list.insertBefore(sibling, slide);
      }
      refresh();
      var button = slide.querySelector(direction < 0 ? '[data-slide-up]' : '[data-slide-down]');
      if (button) {
        button.focus();
      }
    }

    if (addButton) {
      addButton.addEventListener('click', function () {
        if (slides().length >= max) {
          return;
        }
        var slide = template.content.firstElementChild.cloneNode(true);
        list.appendChild(slide);
        refresh();
        var title = slide.querySelector('input[type="text"]');
        if (title) {
          title.focus();
        }
        slide.scrollIntoView({ block: 'nearest' });
      });
    }

    list.addEventListener('click', function (event) {
      var button = event.target.closest('[data-slide-up], [data-slide-down], [data-slide-remove]');
      if (!button || !list.contains(button)) {
        return;
      }
      var slide = button.closest('[data-hero-slide]');
      if (!slide) {
        return;
      }
      if (button.hasAttribute('data-slide-up')) {
        moveSlide(slide, -1);
      } else if (button.hasAttribute('data-slide-down')) {
        moveSlide(slide, 1);
      } else if (!slideHasContent(slide) || window.confirm('Remove this slide? Save the section to keep the change.')) {
        slide.remove();
        refresh();
        if (addButton) {
          addButton.focus();
        }
      }
    });

    list.addEventListener('mousedown', function (event) {
      slides().forEach(function (slide) {
        slide.draggable = false;
      });
      var handle = event.target.closest('[data-slide-handle]');
      var slide = handle ? handle.closest('[data-hero-slide]') : null;
      if (slide) {
        slide.draggable = true;
      }
    });

    list.addEventListener('dragstart', function (event) {
      var slide = event.target.closest('[data-hero-slide]');
      if (!slide || !slide.draggable) {
        event.preventDefault();
        return;
      }
      dragSlide = slide;
      slide.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', 'slide');
    });

    list.addEventListener('dragover', function (event) {
      if (!dragSlide) {
        return;
      }
      event.preventDefault();
      var target = event.target.closest('[data-hero-slide]');
      if (!target || target === dragSlide || !list.contains(target)) {
        return;
      }
      var rect = target.getBoundingClientRect();
      var before = event.clientY < rect.top + rect.height / 2;
      if (before && target.previousElementSibling !== dragSlide) {
        target.before(dragSlide);
      } else if (!before && target.nextElementSibling !== dragSlide) {
        target.after(dragSlide);
      }
    });

    list.addEventListener('drop', function (event) {
      if (dragSlide) {
        event.preventDefault();
      }
    });

    list.addEventListener('dragend', function () {
      if (dragSlide) {
        dragSlide.classList.remove('is-dragging');
        dragSlide.draggable = false;
      }
      dragSlide = null;
      refresh();
    });

    if (form) {
      form.addEventListener('submit', refresh);
    }

    refresh();
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function initRepeaters() {
    document.querySelectorAll('[data-repeater]').forEach(function (repeater) {
      var list = repeater.querySelector('[data-repeater-list]');
      var template = repeater.querySelector('template[data-repeater-template]');
      var addButton = repeater.querySelector('[data-repeater-add]');
      var prefix = repeater.getAttribute('data-repeater-name');
      var max = Number(repeater.getAttribute('data-max')) || 50;
      var count = repeater.querySelector('[data-repeater-count]');
      if (!list || !template || !prefix) {
        return;
      }
      var namePattern = new RegExp('^' + escapeRegExp(prefix) + '\\[\\d+\\]');
      var idPattern = new RegExp('^' + escapeRegExp(prefix) + '-\\d+-');

      function rows() {
        return Array.prototype.filter.call(list.children, function (node) {
          return node.hasAttribute('data-repeater-row');
        });
      }

      function refresh() {
        var items = rows();
        items.forEach(function (row, index) {
          row.querySelectorAll('[name]').forEach(function (field) {
            field.name = field.name.replace(namePattern, prefix + '[' + index + ']');
          });
          row.querySelectorAll('[id]').forEach(function (field) {
            field.id = field.id.replace(idPattern, prefix + '-' + index + '-');
          });
          row.querySelectorAll('[for]').forEach(function (field) {
            field.htmlFor = field.htmlFor.replace(idPattern, prefix + '-' + index + '-');
          });
          ['data-file-browse', 'data-file-clear'].forEach(function (attribute) {
            row.querySelectorAll('[' + attribute + ']').forEach(function (field) {
              field.setAttribute(attribute, field.getAttribute(attribute).replace(idPattern, prefix + '-' + index + '-'));
            });
          });
          row.querySelectorAll('[data-image-preview]').forEach(function (field) {
            var target = field.getAttribute('data-image-preview').replace(/^#/, '');
            field.setAttribute('data-image-preview', '#' + target.replace(idPattern, prefix + '-' + index + '-'));
          });
          row.querySelectorAll('[data-row-up]').forEach(function (button) {
            button.disabled = index === 0;
          });
          row.querySelectorAll('[data-row-down]').forEach(function (button) {
            button.disabled = index === items.length - 1;
          });
        });
        if (addButton) {
          addButton.disabled = items.length >= max;
        }
        if (count) {
          count.textContent = items.length + ' of ' + max;
        }
      }

      if (addButton) {
        addButton.addEventListener('click', function () {
          if (rows().length >= max || !template.content.firstElementChild) {
            return;
          }
          var row = template.content.firstElementChild.cloneNode(true);
          list.appendChild(row);
          refresh();
          var first = row.querySelector('input:not([type="hidden"]), textarea, select');
          if (first) {
            first.focus();
          }
        });
      }

      list.addEventListener('click', function (event) {
        var button = event.target.closest('[data-repeater-remove], [data-row-up], [data-row-down]');
        if (!button || !list.contains(button)) {
          return;
        }
        var row = button.closest('[data-repeater-row]');
        if (button.hasAttribute('data-repeater-remove')) {
          row.remove();
          if (addButton) {
            addButton.focus();
          }
        } else if (button.hasAttribute('data-row-up') && row.previousElementSibling) {
          list.insertBefore(row, row.previousElementSibling);
        } else if (button.hasAttribute('data-row-down') && row.nextElementSibling) {
          list.insertBefore(row.nextElementSibling, row);
        }
        refresh();
      });

      var form = repeater.closest('form');
      if (form) {
        form.addEventListener('submit', refresh);
      }
      refresh();
    });
  }

  function initCatalogSlugCheck() {
    var form = document.querySelector('form[data-catalog-slug-check]');
    if (!form) {
      return;
    }
    var slug = form.querySelector('#slug');
    var status = form.querySelector('[data-slug-status]');
    var parent = form.querySelector('[data-slug-parent]');
    var type = form.getAttribute('data-catalog-type');
    var excludeId = form.getAttribute('data-catalog-id');
    var timer = null;
    if (!slug || !status) {
      return;
    }
    function check() {
      var value = slug.value.trim().toLowerCase();
      if (!value) {
        status.textContent = '';
        return;
      }
      var params = new URLSearchParams({ type: type, slug: value });
      if (parent && parent.value) {
        params.set('parentId', parent.value);
      }
      if (excludeId) {
        params.set('excludeId', excludeId);
      }
      fetch(form.getAttribute('data-catalog-slug-check') + '?' + params.toString(), { headers: { Accept: 'application/json' } })
        .then(function (response) {
          return response.json();
        })
        .then(function (data) {
          if (!data.success) {
            status.className = 'small mt-1 text-danger';
            status.textContent = 'Use lowercase letters, numbers and dashes.';
            return;
          }
          status.className = 'small mt-1 ' + (data.available ? 'text-success' : 'text-danger');
          status.textContent = data.available ? 'This address is available.' : 'This address is already used.';
        })
        .catch(function () {
          status.textContent = '';
        });
    }
    function schedule() {
      window.clearTimeout(timer);
      timer = window.setTimeout(check, 300);
    }
    slug.addEventListener('input', schedule);
    slug.addEventListener('change', schedule);
    if (parent) {
      parent.addEventListener('change', schedule);
    }
  }

  function initCharCounts() {
    document.querySelectorAll('[data-char-count]').forEach(function (field) {
      var limit = Number(field.getAttribute('data-char-count'));
      var counter = document.createElement('small');
      counter.className = 'admin-char-count';
      field.insertAdjacentElement('afterend', counter);
      function update() {
        var length = field.value.length;
        counter.textContent = length + ' / ' + limit;
        counter.classList.toggle('text-danger', length > limit);
      }
      field.addEventListener('input', update);
      update();
    });
  }

  function readJson(id) {
    var node = document.getElementById(id);
    if (!node) {
      return null;
    }
    try {
      return JSON.parse(node.textContent || 'null');
    } catch (error) {
      return null;
    }
  }

  function initMenuBuilder() {
    var form = document.getElementById('menu-form');
    var tree = document.getElementById('menu-tree');
    if (!form || !tree) {
      return;
    }
    var items = readJson('menu-data') || [];
    var pages = readJson('menu-pages') || [];
    var MAX_DEPTH = 3;
    var counter = 0;

    function newId() {
      counter += 1;
      return 'item-' + Date.now().toString(36) + '-' + counter;
    }

    function pageOptions(selected) {
      var html = '<option value="">Custom link</option>';
      pages.forEach(function (page) {
        html += '<option value="' + page.id + '"' + (page.id === selected ? ' selected' : '') + '></option>';
      });
      return html;
    }

    function itemNode(item, depth) {
      var li = document.createElement('li');
      li.className = 'admin-menu-item';
      li.dataset.id = item.id;
      li.innerHTML =
        '<div class="admin-menu-row">' +
        '<div class="admin-menu-fields">' +
        '<input type="text" class="form-control form-control-sm" data-field="title" placeholder="Label" aria-label="Label" />' +
        '<select class="form-select form-select-sm" data-field="pageId" aria-label="Linked page">' + pageOptions(item.pageId) + '</select>' +
        '<input type="text" class="form-control form-control-sm" data-field="url" placeholder="/path or https://" aria-label="Link" />' +
        '<div class="form-check form-switch mb-0"><input class="form-check-input" type="checkbox" data-field="active" aria-label="Visible" /></div>' +
        '</div>' +
        '<div class="btn-group btn-group-sm admin-menu-actions">' +
        '<button type="button" class="btn btn-default" data-action="up" title="Move up"><i class="fa fa-arrow-up"></i></button>' +
        '<button type="button" class="btn btn-default" data-action="down" title="Move down"><i class="fa fa-arrow-down"></i></button>' +
        (depth < MAX_DEPTH ? '<button type="button" class="btn btn-default" data-action="child" title="Add sub-item"><i class="fa fa-level-down-alt"></i></button>' : '') +
        '<button type="button" class="btn btn-danger" data-action="remove" title="Remove"><i class="fa fa-trash"></i></button>' +
        '</div>' +
        '</div>' +
        '<ol class="admin-menu-tree"></ol>';
      var select = li.querySelector('[data-field="pageId"]');
      Array.prototype.forEach.call(select.options, function (option, index) {
        if (index > 0) {
          option.textContent = pages[index - 1].label;
        }
      });
      li.querySelector('[data-field="title"]').value = item.title || '';
      li.querySelector('[data-field="url"]').value = item.url || '';
      li.querySelector('[data-field="active"]').checked = item.active !== false;
      li.dataset.depth = String(depth);
      var childList = li.querySelector('ol');
      (item.children || []).forEach(function (child) {
        childList.appendChild(itemNode(child, depth + 1));
      });
      syncUrlState(li);
      return li;
    }

    function syncUrlState(li) {
      var select = li.querySelector(':scope > .admin-menu-row [data-field="pageId"]');
      var url = li.querySelector(':scope > .admin-menu-row [data-field="url"]');
      var pageId = select.value ? Number(select.value) : null;
      if (pageId) {
        var page = pages.find(function (entry) {
          return entry.id === pageId;
        });
        url.value = page ? page.url : url.value;
        url.readOnly = true;
      } else {
        url.readOnly = false;
      }
    }

    function serialize(list) {
      var result = [];
      Array.prototype.forEach.call(list.children, function (li, index) {
        var row = li.querySelector(':scope > .admin-menu-row');
        var pageValue = row.querySelector('[data-field="pageId"]').value;
        result.push({
          id: li.dataset.id,
          title: row.querySelector('[data-field="title"]').value.trim(),
          url: row.querySelector('[data-field="url"]').value.trim(),
          pageId: pageValue ? Number(pageValue) : null,
          sort: (index + 1) * 10,
          active: row.querySelector('[data-field="active"]').checked,
          children: serialize(li.querySelector(':scope > ol'))
        });
      });
      return result;
    }

    items.forEach(function (item) {
      tree.appendChild(itemNode(item, 1));
    });

    document.querySelectorAll('[data-menu-add]').forEach(function (button) {
      button.addEventListener('click', function () {
        var node = itemNode({ id: newId(), title: '', url: '', pageId: null, active: true, children: [] }, 1);
        tree.appendChild(node);
        node.querySelector('[data-field="title"]').focus();
      });
    });

    tree.addEventListener('change', function (event) {
      if (event.target.matches('[data-field="pageId"]')) {
        var li = event.target.closest('li');
        syncUrlState(li);
        var title = li.querySelector(':scope > .admin-menu-row [data-field="title"]');
        if (!title.value && event.target.value) {
          var page = pages.find(function (entry) {
            return entry.id === Number(event.target.value);
          });
          title.value = page ? page.label.replace(/^(— )+/, '').replace(/ \(draft\)$/, '') : '';
        }
      }
    });

    tree.addEventListener('click', function (event) {
      var button = event.target.closest('[data-action]');
      if (!button) {
        return;
      }
      var li = button.closest('li');
      var action = button.getAttribute('data-action');
      if (action === 'up' && li.previousElementSibling) {
        li.parentElement.insertBefore(li, li.previousElementSibling);
      } else if (action === 'down' && li.nextElementSibling) {
        li.parentElement.insertBefore(li.nextElementSibling, li);
      } else if (action === 'remove') {
        li.remove();
      } else if (action === 'child') {
        var depth = Number(li.dataset.depth) + 1;
        var child = itemNode({ id: newId(), title: '', url: '', pageId: null, active: true, children: [] }, depth);
        li.querySelector(':scope > ol').appendChild(child);
        child.querySelector('[data-field="title"]').focus();
      }
    });

    form.addEventListener('submit', function (event) {
      var data = serialize(tree);
      var invalid = false;
      tree.querySelectorAll('[data-field="title"], [data-field="url"]').forEach(function (field) {
        var empty = field.value.trim() === '';
        field.classList.toggle('is-invalid', empty);
        invalid = invalid || empty;
      });
      if (invalid) {
        event.preventDefault();
        toast('Every menu item needs a label and a link.', 'error');
        tree.querySelector('.is-invalid').focus();
        return;
      }
      document.getElementById('menu-items-input').value = JSON.stringify(data);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initDeleteButtons();
    initToastClose();
    initTableFilters();
    initSlugSources();
    initSlugCheck();
    initFileBrowse();
    initImagePreviews();
    initHeroSlides();
    initRepeaters();
    initCatalogSlugCheck();
    initCharCounts();
    initMenuBuilder();
    window.setTimeout(hideLoader, 300);
  });
  window.addEventListener('load', hideLoader);
})();
