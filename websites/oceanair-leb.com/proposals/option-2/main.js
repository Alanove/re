(() => {
  document.documentElement.classList.remove('no-js');

  const header = document.querySelector('[data-header]');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 50);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const toggle = document.querySelector('[data-nav-toggle]');
  const menu = document.querySelector('[data-nav-menu]');
  const setMenu = (open) => {
    if (open) menu.style.setProperty('--menu-top', `${header.getBoundingClientRect().bottom}px`);
    toggle.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
    document.body.style.overflow = open ? 'hidden' : '';
  };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });
  window.matchMedia('(min-width: 1021px)').addEventListener('change', (e) => { if (e.matches) setMenu(false); });

  const links = [...menu.querySelectorAll('a[href^="#"]:not(.btn)')];
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${entry.target.id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean).forEach((s) => spy.observe(s));

  const tabs = [...document.querySelectorAll('[data-tool]')];
  const selectTool = (name, focus = false) => {
    tabs.forEach((t) => {
      const on = t.dataset.tool === name;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      if (on && focus) t.focus();
    });
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTool(tab.dataset.tool));
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      selectTool(next.dataset.tool, true);
    });
  });
  document.querySelectorAll('[data-tool-link]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      setMenu(false);
      selectTool(link.dataset.toolLink);
      document.getElementById('tools').scrollIntoView({ behavior: 'smooth', block: 'start' });
      const panel = document.getElementById(`p-${link.dataset.toolLink}`);
      window.setTimeout(() => panel.querySelector('input, select')?.focus({ preventScroll: true }), 500);
    });
  });

  const svcImg = document.querySelector('[data-svc-img]');
  const items = [...document.querySelectorAll('[data-svc-item]')];
  const desktop = window.matchMedia('(min-width: 1021px)');
  let swapTimer;
  const activate = (item) => {
    items.forEach((it) => {
      const on = it === item;
      it.classList.toggle('is-active', on);
      it.setAttribute('aria-expanded', String(on));
    });
    if (svcImg.getAttribute('src') === item.dataset.img) return;
    window.clearTimeout(swapTimer);
    svcImg.classList.add('is-swapping');
    swapTimer = window.setTimeout(() => {
      svcImg.src = item.dataset.img;
      svcImg.alt = item.dataset.alt;
      svcImg.classList.remove('is-swapping');
    }, 220);
  };
  items.forEach((item) => {
    item.addEventListener('click', () => activate(item));
    item.addEventListener('mouseenter', () => { if (desktop.matches) activate(item); });
    item.addEventListener('focus', () => { if (desktop.matches) activate(item); });
  });

  document.querySelectorAll('[data-demo-form]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      form.querySelector('.form-msg').textContent = form.dataset.msg;
    });
  });

  const reveal = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      reveal.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el, i) => {
    el.style.transitionDelay = `${(i % 4) * 70}ms`;
    reveal.observe(el);
  });

  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });

  const video = document.getElementById('video');
  if (video) {
    const frame = video.querySelector('iframe');
    const openVideo = () => {
      if (frame && frame.dataset.src) frame.src = frame.dataset.src;
      video.showModal();
    };
    const stopVideo = () => { if (frame) frame.removeAttribute('src'); };
    document.querySelectorAll('[data-open-video]').forEach((btn) => btn.addEventListener('click', openVideo));
    video.addEventListener('close', stopVideo);
    video.addEventListener('click', (e) => { if (e.target === video) video.close(); });
  }
})();
