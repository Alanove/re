(function () {
  'use strict';

  function formatCount(n) {
    var num = Number(n) || 0;
    if (num <= 0) return '';
    return num > 99 ? '99+' : String(num);
  }

  function updateMenuBadge(total) {
    var el = document.querySelector('[data-chat-menu-badge]');
    if (!el) return;
    var n = Number(total) || 0;
    if (n > 0) {
      el.textContent = formatCount(n);
      el.classList.remove('d-none');
    } else {
      el.textContent = '';
      el.classList.add('d-none');
    }
  }

  function refreshMenuBadge() {
    var meta = document.querySelector('meta[name="csrf-token"]');
    var csrf = meta && meta.getAttribute('content');
    return fetch('/admin/api/chat/unread-total', {
      credentials: 'same-origin',
      headers: csrf ? { 'X-CSRF-Token': csrf } : {},
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data && data.success) {
          updateMenuBadge(data.total);
        }
      })
      .catch(function () {});
  }

  window.adminChatUpdateMenuBadge = updateMenuBadge;
  window.adminChatRefreshMenuBadge = refreshMenuBadge;

  if (document.querySelector('[data-chat-menu-badge]')) {
    refreshMenuBadge();
    setInterval(refreshMenuBadge, 15000);
  }
})();
