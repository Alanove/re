// Public site behaviour. Loaded as an ES module, so it runs after the document is parsed.

const root = document.documentElement;
const body = document.body;
let openLayers = 0;

function lockScroll(lock) {
  openLayers = Math.max(0, openLayers + (lock ? 1 : -1));
  body.classList.toggle('is-locked', openLayers > 0);
}

function debounce(fn, wait) {
  let timer = 0;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

/* Search overlay with live suggestions. */
function initSearch() {
  const panel = document.querySelector('[data-search-panel]');
  if (!panel) {
    return;
  }
  const input = panel.querySelector('[data-search-input]');
  const list = panel.querySelector('[data-search-results]');
  const hint = panel.querySelector('[data-search-hint]');
  const all = panel.querySelector('[data-search-all]');
  let lastFocus = null;
  let controller = null;
  let active = -1;

  const options = () => [...list.querySelectorAll('a')];

  const setActive = (index) => {
    const items = options();
    active = items.length ? (index + items.length) % items.length : -1;
    items.forEach((item, i) => item.setAttribute('aria-selected', String(i === active)));
    if (active >= 0) {
      input.setAttribute('aria-activedescendant', items[active].id);
      items[active].scrollIntoView({ block: 'nearest' });
    } else {
      input.removeAttribute('aria-activedescendant');
    }
  };

  const showHint = (text) => {
    list.replaceChildren();
    input.setAttribute('aria-expanded', 'false');
    hint.textContent = text;
    hint.hidden = false;
    active = -1;
  };

  const fetchSuggestions = debounce(async (query) => {
    controller?.abort();
    controller = new AbortController();
    try {
      const response = await fetch(`/api/search/suggest?q=${encodeURIComponent(query)}`, {
        headers: { Accept: 'application/json' },
        signal: controller.signal
      });
      if (!response.ok) {
        showHint('تعذّر البحث الآن. اضغط Enter لعرض صفحة النتائج.');
        return;
      }
      const data = await response.json();
      if (input.value.trim() !== query) {
        return;
      }
      if (!data.suggestions.length) {
        showHint('لا توجد اقتراحات. اضغط Enter للبحث في كل الموقع.');
        return;
      }
      hint.hidden = true;
      list.replaceChildren(
        ...data.suggestions.map((item, index) => {
          const li = document.createElement('li');
          const link = document.createElement('a');
          link.href = item.url;
          link.id = `search-option-${index}`;
          link.setAttribute('role', 'option');
          const title = document.createElement('span');
          title.textContent = item.title;
          const type = document.createElement('small');
          type.textContent = item.typeLabel;
          link.append(title, type);
          li.append(link);
          return li;
        })
      );
      input.setAttribute('aria-expanded', 'true');
      active = -1;
    } catch (error) {
      if (error.name !== 'AbortError') {
        showHint('تعذّر البحث الآن. اضغط Enter لعرض صفحة النتائج.');
      }
    }
  }, 250);

  const update = () => {
    const query = input.value.trim();
    all.hidden = query.length === 0;
    all.href = `/search?q=${encodeURIComponent(query)}`;
    if (query.length < 2) {
      controller?.abort();
      showHint('اكتب كلمتين على الأقل. البحث لا يتأثر بالتشكيل أو بالهمزات.');
      return;
    }
    fetchSuggestions(query);
  };

  const open = () => {
    if (!panel.hidden) {
      return;
    }
    lastFocus = document.activeElement;
    panel.hidden = false;
    lockScroll(true);
    input.focus();
    input.select();
    update();
  };

  const close = () => {
    if (panel.hidden) {
      return;
    }
    panel.hidden = true;
    lockScroll(false);
    controller?.abort();
    lastFocus?.focus?.();
  };

  document.querySelectorAll('[data-search-open]').forEach((trigger) => {
    trigger.addEventListener('click', (event) => {
      event.preventDefault();
      open();
    });
  });
  panel.querySelector('[data-search-close]').addEventListener('click', close);
  panel.addEventListener('click', (event) => {
    if (event.target === panel) {
      close();
    }
  });
  input.addEventListener('input', update);
  input.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActive(active + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActive(active - 1);
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault();
      options()[active].click();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hidden) {
      close();
      return;
    }
    const target = event.target;
    const typing = target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));
    if (event.key === '/' && !typing && panel.hidden) {
      event.preventDefault();
      open();
    }
  });
}

/* Mobile navigation drawer. */
function initDrawer() {
  const drawer = document.querySelector('[data-drawer]');
  const backdrop = document.querySelector('[data-drawer-backdrop]');
  const toggle = document.querySelector('[data-drawer-open]');
  if (!drawer || !backdrop || !toggle) {
    return;
  }
  const close = () => {
    if (!drawer.classList.contains('is-open')) {
      return;
    }
    drawer.classList.remove('is-open');
    backdrop.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    lockScroll(false);
    toggle.focus();
  };
  toggle.addEventListener('click', () => {
    drawer.classList.add('is-open');
    backdrop.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
    lockScroll(true);
    drawer.querySelector('[data-drawer-close]').focus();
  });
  drawer.querySelector('[data-drawer-close]').addEventListener('click', close);
  backdrop.addEventListener('click', close);
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      close();
    }
  });
  window.matchMedia('(min-width: 1280px)').addEventListener('change', (event) => {
    if (event.matches) {
      close();
    }
  });
}

/*
 * Sticky hymn player. Pressing play takes the playable hymns listed at that moment as the queue, so the
 * queue survives the hymn list being swapped by category or search (see initHymnNavigation).
 */
function initPlayer() {
  const player = document.querySelector('[data-player]');
  if (!player || !document.querySelector('[data-hymn]')) {
    return;
  }
  const audio = player.querySelector('[data-player-audio]');
  const title = player.querySelector('[data-player-title]');
  const seek = player.querySelector('[data-player-seek]');
  const current = player.querySelector('[data-player-current]');
  const duration = player.querySelector('[data-player-duration]');
  const icon = player.querySelector('[data-player-icon] use');
  const rows = () => [...document.querySelectorAll('[data-hymn]')];
  let queue = [];
  let index = -1;

  const time = (seconds) => {
    if (!Number.isFinite(seconds)) {
      return '0:00';
    }
    const whole = Math.floor(seconds);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
  };

  const syncHeight = () => {
    root.style.setProperty('--player-height', player.hidden ? '0px' : `${player.offsetHeight}px`);
  };
  new ResizeObserver(syncHeight).observe(player);

  const render = () => {
    const playing = !audio.paused;
    const currentId = queue[index]?.id;
    rows().forEach((row) => {
      const active = row.id === currentId && playing;
      row.classList.toggle('is-playing', active);
      row.querySelector('[data-hymn-play]')?.setAttribute('aria-pressed', String(active));
    });
    icon.setAttribute('href', playing ? '#i-pause' : '#i-play');
  };

  const load = (next) => {
    if (!queue.length) {
      return;
    }
    index = (next + queue.length) % queue.length;
    const track = queue[index];
    audio.src = track.src;
    title.textContent = track.title;
    seek.value = '0';
    current.textContent = '0:00';
    duration.textContent = '0:00';
    player.hidden = false;
    syncHeight();
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({ title: track.title, artist: document.title });
    }
    audio.play().catch(() => render());
  };

  document.addEventListener('click', (event) => {
    const row = event.target instanceof Element ? event.target.closest('[data-hymn-play]')?.closest('[data-hymn]') : null;
    if (!row) {
      return;
    }
    if (row.id === queue[index]?.id) {
      if (audio.paused) {
        audio.play().catch(() => render());
      } else {
        audio.pause();
      }
      return;
    }
    const listed = rows();
    queue = listed.map((entry) => ({ id: entry.id, src: entry.dataset.src, title: entry.dataset.title }));
    load(listed.indexOf(row));
  });
  document.addEventListener('hymns:listchange', render);

  player.querySelector('[data-player-toggle]').addEventListener('click', () => {
    if (audio.paused) {
      audio.play().catch(() => render());
    } else {
      audio.pause();
    }
  });
  player.querySelector('[data-player-next]').addEventListener('click', () => load(index + 1));
  player.querySelector('[data-player-prev]').addEventListener('click', () => {
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
    } else {
      load(index - 1);
    }
  });
  player.querySelector('[data-player-close]').addEventListener('click', () => {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    queue = [];
    index = -1;
    player.hidden = true;
    syncHeight();
    render();
  });
  seek.addEventListener('input', () => {
    if (Number.isFinite(audio.duration)) {
      audio.currentTime = (Number(seek.value) / 100) * audio.duration;
    }
  });
  audio.addEventListener('timeupdate', () => {
    current.textContent = time(audio.currentTime);
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      seek.value = String((audio.currentTime / audio.duration) * 100);
    }
  });
  audio.addEventListener('loadedmetadata', () => {
    duration.textContent = time(audio.duration);
  });
  audio.addEventListener('play', render);
  audio.addEventListener('pause', render);
  audio.addEventListener('ended', () => {
    if (index < queue.length - 1) {
      load(index + 1);
    } else {
      render();
    }
  });
  audio.addEventListener('error', () => {
    if (audio.getAttribute('src')) {
      title.textContent = `تعذّر تشغيل: ${queue[index]?.title ?? ''}`;
      render();
    }
  });
  if ('mediaSession' in navigator) {
    navigator.mediaSession.setActionHandler('nexttrack', () => load(index + 1));
    navigator.mediaSession.setActionHandler('previoustrack', () => load(index - 1));
  }

  const hash = decodeURIComponent(window.location.hash.slice(1));
  const target = hash.startsWith('hymn-') ? document.getElementById(hash) : null;
  if (target?.matches('[data-hymn]')) {
    target.scrollIntoView({ block: 'center' });
  }
}

/* Hymn categories and search swap the list in place, so the player keeps playing; full loads remain the fallback. */
function initHymnNavigation() {
  const selector = '[data-hymn-page]';
  if (!document.querySelector(selector) || !window.history.pushState) {
    return;
  }
  let pending = null;

  const swap = async (url, push, focusHref) => {
    pending?.abort();
    const controller = new AbortController();
    pending = controller;
    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: 'text/html' } });
      if (!response.ok) {
        throw new Error(String(response.status));
      }
      const next = new DOMParser().parseFromString(await response.text(), 'text/html').querySelector(selector);
      const currentBody = document.querySelector(selector);
      if (!next || !currentBody) {
        throw new Error('missing hymn list');
      }
      currentBody.replaceWith(document.importNode(next, true));
      if (push) {
        window.history.pushState({ hymns: true }, '', url);
      }
      document.dispatchEvent(new CustomEvent('hymns:listchange'));
      const focusTarget = (focusHref && [...document.querySelectorAll(`${selector} a[href]`)].find((link) => link.href === focusHref)) || document.querySelector(`${selector} input[name="q"]`);
      focusTarget?.focus({ preventScroll: true });
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) {
        window.location.href = url;
      }
    } finally {
      if (pending === controller) {
        pending = null;
      }
    }
  };

  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const link = event.target instanceof Element ? event.target.closest(`${selector} a[href]`) : null;
    if (!link || link.hasAttribute('download') || link.target || link.closest('[data-hymn]')) {
      return;
    }
    const url = new URL(link.href);
    if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || (url.hash && url.search === window.location.search)) {
      return;
    }
    event.preventDefault();
    swap(url.href, true, link.href);
  });

  document.addEventListener('submit', (event) => {
    const form = event.target instanceof HTMLFormElement ? event.target.closest(`${selector} form[method="get"]`) : null;
    if (!form) {
      return;
    }
    const url = new URL(form.action, window.location.href);
    url.search = '';
    new FormData(form).forEach((value, key) => {
      if (typeof value === 'string' && value.trim() !== '') {
        url.searchParams.append(key, value.trim());
      }
    });
    event.preventDefault();
    swap(url.href, true, null);
  });

  window.history.replaceState({ hymns: true }, '', window.location.href);
  window.addEventListener('popstate', (event) => {
    if (event.state?.hymns) {
      swap(window.location.href, false, null);
    }
  });
}

/* Lightbox for photo grids. */
function initLightbox() {
  const groups = [...document.querySelectorAll('[data-lightbox-group]')];
  if (!groups.length) {
    return;
  }
  let items = [];
  let index = 0;
  let lastFocus = null;
  let startX = null;

  const box = document.createElement('div');
  box.className = 'lightbox';
  box.hidden = true;
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', 'عارض الصور');
  box.innerHTML = `
    <div class="lightbox__bar">
      <span data-lb-count></span>
      <button class="icon-button" type="button" data-lb-close aria-label="إغلاق"><svg class="icon" aria-hidden="true"><use href="#i-close"/></svg></button>
    </div>
    <div class="lightbox__stage"><img alt="" data-lb-image /></div>
    <p class="lightbox__caption" data-lb-caption></p>
    <button class="lightbox__nav lightbox__nav--prev" type="button" data-lb-prev aria-label="الصورة السابقة"><svg class="icon" aria-hidden="true"><use href="#i-chevron"/></svg></button>
    <button class="lightbox__nav lightbox__nav--next" type="button" data-lb-next aria-label="الصورة التالية"><svg class="icon icon-flip" aria-hidden="true"><use href="#i-chevron"/></svg></button>`;
  body.append(box);
  const image = box.querySelector('[data-lb-image]');
  const caption = box.querySelector('[data-lb-caption]');
  const count = box.querySelector('[data-lb-count]');

  const show = (next) => {
    index = (next + items.length) % items.length;
    const link = items[index];
    image.src = link.href;
    image.alt = link.querySelector('img')?.alt ?? '';
    caption.textContent = link.dataset.caption ?? '';
    count.textContent = `${index + 1} / ${items.length}`;
    const preload = items[(index + 1) % items.length];
    if (preload) {
      new Image().src = preload.href;
    }
  };

  const close = () => {
    box.hidden = true;
    image.removeAttribute('src');
    lockScroll(false);
    lastFocus?.focus?.();
  };

  groups.forEach((group) => {
    const links = [...group.querySelectorAll('[data-lightbox]')];
    links.forEach((link, i) => {
      link.addEventListener('click', (event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey) {
          return;
        }
        event.preventDefault();
        items = links;
        lastFocus = link;
        box.hidden = false;
        lockScroll(true);
        show(i);
        box.querySelector('[data-lb-close]').focus();
      });
    });
  });

  box.querySelector('[data-lb-close]').addEventListener('click', close);
  box.querySelector('[data-lb-prev]').addEventListener('click', () => show(index - 1));
  box.querySelector('[data-lb-next]').addEventListener('click', () => show(index + 1));
  box.addEventListener('click', (event) => {
    if (event.target === box || event.target.classList.contains('lightbox__stage')) {
      close();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (box.hidden) {
      return;
    }
    const rtl = root.dir === 'rtl';
    if (event.key === 'Escape') {
      close();
    } else if (event.key === 'ArrowLeft') {
      show(rtl ? index + 1 : index - 1);
    } else if (event.key === 'ArrowRight') {
      show(rtl ? index - 1 : index + 1);
    }
  });
  box.addEventListener('touchstart', (event) => {
    startX = event.touches[0].clientX;
  }, { passive: true });
  box.addEventListener('touchend', (event) => {
    if (startX === null) {
      return;
    }
    const delta = event.changedTouches[0].clientX - startX;
    startX = null;
    if (Math.abs(delta) > 50) {
      const forward = root.dir === 'rtl' ? delta > 0 : delta < 0;
      show(forward ? index + 1 : index - 1);
    }
  });
}

/* YouTube facade: the player iframe loads only after a click. */
function initVideos() {
  document.querySelectorAll('[data-youtube]').forEach((button) => {
    button.addEventListener('click', () => {
      const id = button.dataset.youtube;
      if (!/^[\w-]{6,20}$/.test(id)) {
        return;
      }
      const frame = document.createElement('iframe');
      frame.src = `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
      frame.title = button.dataset.title ?? 'YouTube';
      frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      frame.allowFullscreen = true;
      const wrapper = document.createElement('div');
      wrapper.className = 'video-facade is-playing';
      wrapper.append(frame);
      button.replaceWith(wrapper);
      frame.focus();
    }, { once: true });
  });
}

/* Newsletter sign-up without leaving the page. */
function initNewsletter() {
  document.querySelectorAll('[data-newsletter-form]').forEach((form) => {
    const status = form.querySelector('[data-newsletter-status]');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      status.textContent = '';
      try {
        const response = await fetch(form.action, {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(new FormData(form)).toString()
        });
        const data = await response.json();
        status.textContent = data.message ?? (response.ok ? 'شكراً لاشتراكك.' : 'تعذّر الاشتراك.');
        if (response.ok && data.success) {
          form.reset();
        }
      } catch {
        status.textContent = 'تعذّر الاتصال. حاول مرة أخرى.';
      } finally {
        button.disabled = false;
      }
    });
  });
  const params = new URLSearchParams(window.location.search);
  const status = document.querySelector('[data-newsletter-status]');
  if (status && params.get('newsletter') === '1') {
    status.textContent = 'شكراً لاشتراكك.';
  } else if (status && params.get('newsletter') === 'invalid') {
    status.textContent = 'يرجى إدخال بريد إلكتروني صحيح.';
  }
}

function initCopyLinks() {
  document.querySelectorAll('[data-copy-link]').forEach((button) => {
    button.addEventListener('click', async () => {
      const status = button.closest('.aside-box')?.querySelector('[data-copy-status]');
      try {
        await navigator.clipboard.writeText(button.dataset.copyLink);
        if (status) {
          status.textContent = 'تم نسخ الرابط.';
        }
      } catch {
        if (status) {
          status.textContent = button.dataset.copyLink;
        }
      }
    });
  });
}

function initBackToTop() {
  const button = document.querySelector('[data-back-to-top]');
  if (!button) {
    return;
  }
  const sync = () => {
    button.hidden = window.scrollY < 600;
  };
  window.addEventListener('scroll', sync, { passive: true });
  sync();
  button.addEventListener('click', (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    document.getElementById('main')?.focus({ preventScroll: true });
  });
}

/* Library and hymn filters: dropdowns apply at once; empty fields stay out of the URL. */
function initFilters() {
  document.querySelectorAll('form[data-filters]').forEach((form) => {
    form.addEventListener('change', (event) => {
      if (event.target instanceof HTMLSelectElement) {
        form.requestSubmit();
      }
    });
    form.addEventListener('submit', () => {
      form.querySelectorAll('input[name], select[name]').forEach((field) => {
        if (field.value.trim() === '') {
          field.disabled = true;
        }
      });
    });
    window.addEventListener('pageshow', () => {
      form.querySelectorAll(':disabled').forEach((field) => {
        field.disabled = false;
      });
    });
  });
}

/* Home أضواء hero: tabbed slides that advance on their own unless the visitor is reading, prefers reduced motion or paused them. */
function initHero() {
  const hero = document.querySelector('[data-hero]');
  const tablist = hero?.querySelector('[data-hero-tabs]');
  if (!hero || !tablist) {
    return;
  }
  const slides = [...hero.querySelectorAll('[data-hero-slide]')];
  const tabs = [...tablist.querySelectorAll('[data-hero-tab]')];
  const toggle = hero.querySelector('[data-hero-toggle]');
  const toggleIcon = toggle.querySelector('use');
  const stage = hero.querySelector('[data-hero-stage]');
  const interval = 7000;
  const rtl = () => getComputedStyle(hero).direction === 'rtl';
  let index = 0;
  let timer = 0;
  let remaining = interval;
  let startedAt = 0;
  let userPaused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let hovering = false;
  let focused = false;

  tablist.setAttribute('role', 'tablist');
  tabs.forEach((tab, i) => {
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', slides[i].id);
    tab.removeAttribute('aria-current');
    slides[i].setAttribute('role', 'tabpanel');
    slides[i].setAttribute('aria-labelledby', tab.id);
  });
  hero.style.setProperty('--hero-interval', `${interval}ms`);

  const held = () => userPaused || hovering || focused || document.hidden;

  const stop = () => {
    if (timer) {
      window.clearTimeout(timer);
      timer = 0;
      remaining = Math.max(0, remaining - (performance.now() - startedAt));
    }
  };

  const sync = () => {
    hero.toggleAttribute('data-running', !userPaused);
    hero.toggleAttribute('data-paused', held());
    toggle.setAttribute('aria-label', userPaused ? 'تشغيل التمرير التلقائي' : 'إيقاف التمرير التلقائي');
    toggleIcon.setAttribute('href', userPaused ? '#i-play' : '#i-pause');
    stop();
    if (!held()) {
      startedAt = performance.now();
      timer = window.setTimeout(() => {
        timer = 0;
        show(index + 1);
      }, remaining);
    }
  };

  function show(next, focusTab = false) {
    index = (next + slides.length) % slides.length;
    slides.forEach((slide, i) => {
      const active = i === index;
      slide.classList.toggle('is-active', active);
      slide.inert = !active;
    });
    tabs.forEach((tab, i) => {
      const active = i === index;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
    });
    [index, (index + 1) % slides.length].forEach((i) => {
      const image = slides[i].querySelector('img');
      if (image) {
        image.loading = 'eager';
      }
    });
    if (focusTab) {
      tabs[index].focus();
    }
    stop();
    remaining = interval;
    sync();
  }

  tablist.addEventListener('click', (event) => {
    const tab = event.target instanceof Element ? event.target.closest('[data-hero-tab]') : null;
    if (!tab) {
      return;
    }
    event.preventDefault();
    show(tabs.indexOf(tab));
  });

  tablist.addEventListener('keydown', (event) => {
    const forward = rtl() ? 'ArrowLeft' : 'ArrowRight';
    const back = rtl() ? 'ArrowRight' : 'ArrowLeft';
    const moves = { [forward]: index + 1, [back]: index - 1, Home: 0, End: slides.length - 1 };
    if (event.key in moves) {
      event.preventDefault();
      show(moves[event.key], true);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      window.location.href = tabs[index].href;
    }
  });

  toggle.hidden = false;
  toggle.addEventListener('click', () => {
    userPaused = !userPaused;
    if (!userPaused) {
      remaining = interval;
    }
    sync();
  });

  hero.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') {
      hovering = true;
      sync();
    }
  });
  hero.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') {
      hovering = false;
      sync();
    }
  });
  hero.addEventListener('focusin', () => {
    focused = true;
    sync();
  });
  hero.addEventListener('focusout', (event) => {
    if (!(event.relatedTarget instanceof Node && hero.contains(event.relatedTarget))) {
      focused = false;
      sync();
    }
  });
  document.addEventListener('visibilitychange', sync);

  let swipe = null;
  let swiped = false;
  stage.addEventListener('pointerdown', (event) => {
    swiped = false;
    swipe = event.pointerType === 'mouse' ? null : { x: event.clientX, y: event.clientY };
  });
  stage.addEventListener('pointerup', (event) => {
    if (!swipe) {
      return;
    }
    const dx = event.clientX - swipe.x;
    const dy = event.clientY - swipe.y;
    swipe = null;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      swiped = true;
      const advance = rtl() ? dx > 0 : dx < 0;
      show(advance ? index + 1 : index - 1);
    }
  });
  stage.addEventListener('pointercancel', () => {
    swipe = null;
  });
  stage.addEventListener(
    'click',
    (event) => {
      if (swiped) {
        event.preventDefault();
        swiped = false;
      }
    },
    true
  );

  show(0);
}

initSearch();
initHero();
initFilters();
initDrawer();
initPlayer();
initHymnNavigation();
initLightbox();
initVideos();
initNewsletter();
initCopyLinks();
initBackToTop();
