(function () {

  'use strict';



  var meta = document.querySelector('meta[name="csrf-token"]');

  var csrf = meta && meta.getAttribute('content');



  function esc(s) {

    var d = document.createElement('div');

    d.textContent = s == null ? '' : String(s);

    return d.innerHTML;

  }



  function formatUnread(n) {

    var num = Number(n) || 0;

    if (num <= 0) return '';

    return num > 99 ? '99+' : String(num);

  }



  function updateMenuBadge(total) {

    if (typeof window.adminChatUpdateMenuBadge === 'function') {

      window.adminChatUpdateMenuBadge(total);

    }

  }



  var threadEl = document.getElementById('adminChatThread');

  var inputEl = document.getElementById('adminChatInput');

  var sendBtn = document.getElementById('adminChatSend');

  var listEl = document.getElementById('adminChatList');

  var currentPk = null;

  var socket = null;

  var listRefreshTimer = null;

  var pollIntervalId = null;

  var socketInitAttempts = 0;



  function fmtTime(d) {

    try {

      return new Date(d).toLocaleString();

    } catch (e) {

      return '';

    }

  }



  function lineTitle(c) {

    var hasContact = c.visitor_first_name || c.visitor_email || c.visitor_phone;

    if (!hasContact) return 'Anonymous';

    var parts = [c.visitor_first_name, c.visitor_email].filter(Boolean);

    return parts.length ? parts.join(' Â· ') : 'Anonymous';

  }



  function appendUnreadBadge(container, count) {

    var n = Number(count) || 0;

    if (n <= 0) return;

    var badge = document.createElement('span');

    badge.className = 'badge rounded-pill bg-danger chat-conv-unread-badge';

    badge.textContent = formatUnread(n);

    container.appendChild(badge);

  }



  /** Rebuild left list from API JSON (keeps selection via currentPk). */

  function renderConversationList(conversations, totalUnread) {

    if (!listEl) return;

    var convs = conversations || [];

    if (typeof totalUnread === 'number') {

      updateMenuBadge(totalUnread);

    }

    listEl.innerHTML = '';

    if (convs.length === 0) {

      listEl.innerHTML =

        '<div class="p-4 text-center text-muted">No conversations yet.</div>';

      return;

    }

    convs.forEach(function (c) {

      var pk = c.public_key;

      var a = document.createElement('a');

      a.href = '#';

      a.className = 'list-group-item list-group-item-action';

      a.setAttribute('data-public-key', pk);

      if (currentPk === pk) {

        a.classList.add('active');

      }

      var row = document.createElement('div');

      row.className = 'd-flex justify-content-between align-items-start';

      var strong = document.createElement('strong');

      strong.className = 'd-block text-truncate';

      strong.style.maxWidth = '70%';

      strong.textContent = lineTitle(c);

      var right = document.createElement('span');

      right.className = 'd-flex align-items-center flex-shrink-0 gap-1';

      appendUnreadBadge(right, c.unread_count);

      var smallTime = document.createElement('small');

      smallTime.className = 'text-muted text-nowrap';

      smallTime.textContent = c.last_message_at ? fmtTime(c.last_message_at) : '';

      row.appendChild(strong);

      right.appendChild(smallTime);

      row.appendChild(right);

      a.appendChild(row);

      if (c.visitor_phone) {

        var smallPhone = document.createElement('small');

        smallPhone.className = 'text-muted d-block';

        smallPhone.textContent = c.visitor_phone;

        a.appendChild(smallPhone);

      }

      listEl.appendChild(a);

    });

  }



  function refreshConversationList() {

    if (!listEl) return;

    fetch('/admin/api/chat/conversations', {

      credentials: 'same-origin',

      headers: csrf ? { 'X-CSRF-Token': csrf } : {},

    })

      .then(function (r) {

        return r.json();

      })

      .then(function (data) {

        if (data && data.success && data.conversations) {

          renderConversationList(data.conversations, data.totalUnread);

        }

      })

      .catch(function () {});

  }



  function scheduleListRefresh() {

    if (listRefreshTimer) {

      clearTimeout(listRefreshTimer);

    }

    listRefreshTimer = setTimeout(function () {

      listRefreshTimer = null;

      refreshConversationList();

    }, 120);

  }



  function renderThread(messages) {

    if (!threadEl) return;

    threadEl.innerHTML = '';

    var list = messages || [];

    if (list.length === 0) {

      var empty = document.createElement('div');

      empty.className = 'chat-admin-thread-empty text-muted';

      empty.textContent = 'No messages yet.';

      threadEl.appendChild(empty);

      return;

    }

    list.forEach(function (m) {

      var isStaff = m.sender === 'staff';

      var bubble = document.createElement('div');

      bubble.className =

        'chat-admin-bubble ' +

        (isStaff ? 'chat-admin-bubble--staff' : 'chat-admin-bubble--visitor');

      var meta = document.createElement('div');

      meta.className = 'chat-admin-bubble__meta';

      meta.textContent =

        (isStaff ? 'You' : 'Visitor') + ' · ' + fmtTime(m.createdAt);

      var body = document.createElement('div');

      body.className = 'chat-admin-bubble__body';

      body.textContent = m.body == null ? '' : String(m.body);

      bubble.appendChild(meta);

      bubble.appendChild(body);

      threadEl.appendChild(bubble);

    });

    threadEl.scrollTop = threadEl.scrollHeight;

  }



  function loadThread(pk) {

    return fetch(

      '/admin/api/chat/messages?publicKey=' + encodeURIComponent(pk),

      {

        credentials: 'same-origin',

        headers: csrf ? { 'X-CSRF-Token': csrf } : {},

      }

    )

      .then(function (r) {

        return r.json();

      })

      .then(function (data) {

        if (data && data.success && data.messages) {

          renderThread(data.messages);

          if (typeof data.totalUnread === 'number') {

            updateMenuBadge(data.totalUnread);

          }

          scheduleListRefresh();

        }

      })

      .catch(function () {});

  }



  function selectPublicKey(pk) {

    if (!pk) return;

    currentPk = pk;

    if (listEl) {

      listEl.querySelectorAll('[data-public-key]').forEach(function (el) {

        el.classList.toggle('active', el.getAttribute('data-public-key') === pk);

      });

    }

    loadThread(pk);

  }



  function onRealtimeActivity(msg) {

    if (msg && msg.publicKey && msg.publicKey === currentPk) {

      loadThread(currentPk);

    } else {

      scheduleListRefresh();

    }

    if (typeof window.adminChatRefreshMenuBadge === 'function') {

      window.adminChatRefreshMenuBadge();

    }

  }



  function bindSocketHandlers(sock) {

    sock.on('chat:message', onRealtimeActivity);

    sock.on('chat:list-changed', function () {

      scheduleListRefresh();

      if (typeof window.adminChatRefreshMenuBadge === 'function') {

        window.adminChatRefreshMenuBadge();

      }

    });

    sock.on('chat:staff-ready', function () {

      scheduleListRefresh();

      if (typeof window.adminChatRefreshMenuBadge === 'function') {

        window.adminChatRefreshMenuBadge();

      }

    });

    sock.on('connect', function () {

      scheduleListRefresh();

      if (typeof window.adminChatRefreshMenuBadge === 'function') {

        window.adminChatRefreshMenuBadge();

      }

    });

  }



  function ensureSocket() {

    if (socket) return;

    if (typeof window.io !== 'function') {

      if (socketInitAttempts < 20) {

        socketInitAttempts += 1;

        setTimeout(ensureSocket, 50);

      }

      return;

    }



    socket = window.io({

      path: '/socket.io',

      withCredentials: true,

      transports: ['websocket', 'polling'],

      auth: { role: 'staff' },

    });

    bindSocketHandlers(socket);

  }



  function startListPolling() {

    if (pollIntervalId) return;

    pollIntervalId = setInterval(function () {

      refreshConversationList();

      if (typeof window.adminChatRefreshMenuBadge === 'function') {

        window.adminChatRefreshMenuBadge();

      }

    }, 12000);

  }



  function send() {

    if (!currentPk || !inputEl) return;

    var body = inputEl.value.trim();

    if (!body) return;

    ensureSocket();

    if (!socket) return;



    function emitAndRefresh() {

      socket.emit('staff:message', { publicKey: currentPk, body: body });

      inputEl.value = '';

      setTimeout(function () {

        loadThread(currentPk);

        scheduleListRefresh();

      }, 200);

    }



    if (!socket.connected) {

      socket.once('connect', emitAndRefresh);

      return;

    }

    emitAndRefresh();

  }



  if (listEl) {

    listEl.addEventListener('click', function (e) {

      var t = e.target.closest('[data-public-key]');

      if (!t) return;

      e.preventDefault();

      ensureSocket();

      selectPublicKey(t.getAttribute('data-public-key'));

    });

  }

  if (sendBtn) sendBtn.addEventListener('click', send);

  if (inputEl) {

    inputEl.addEventListener('keydown', function (ev) {

      if (ev.key === 'Enter' && !ev.shiftKey) {

        ev.preventDefault();

        send();

      }

    });

  }



  ensureSocket();

  startListPolling();



  var first = listEl && listEl.querySelector('[data-public-key]');

  if (first) {

    selectPublicKey(first.getAttribute('data-public-key'));

  }

})();


