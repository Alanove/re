(() => {
  const root = document.documentElement;
  root.classList.remove('no-js');

  const header = document.querySelector('[data-header]');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const toggle = document.querySelector('[data-nav-toggle]');
  const menu = document.querySelector('[data-nav-menu]');
  const setMenu = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
  };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') setMenu(false); });

  const links = [...menu.querySelectorAll('a[href^="#"]')];
  const sections = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((a) => a.classList.toggle('is-active', a.getAttribute('href') === `#${entry.target.id}`));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  sections.forEach((s) => spy.observe(s));

  const tabs = [...document.querySelectorAll('[data-tab]')];
  const selectTab = (tab) => {
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
    });
  };
  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => selectTab(tab));
    tab.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      selectTab(next);
      next.focus();
    });
  });

  document.querySelectorAll('[data-track-form]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const ref = form.elements.ref.value.trim();
      form.querySelector('.track-msg').textContent = `Searching for "${ref}"… (design preview: connects to the WWA tracking system on the live site)`;
    });
  });

  document.querySelectorAll('[data-demo-form]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      form.querySelector('.form-msg').textContent = 'Thank you. This is a design preview, so nothing was sent.';
      form.reset();
    });
  });

  const dialog = document.getElementById('inquiry');
  document.querySelectorAll('[data-open-inquiry]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setMenu(false);
      dialog.querySelector('.form-msg').textContent = '';
      dialog.showModal();
    });
  });
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  const video = document.getElementById('video');
  if (video) {
    const frame = video.querySelector('iframe');
    const openVideo = () => {
      setMenu(false);
      if (frame && frame.dataset.src) frame.src = frame.dataset.src;
      video.showModal();
    };
    const stopVideo = () => { if (frame) frame.removeAttribute('src'); };
    document.querySelectorAll('[data-open-video]').forEach((btn) => btn.addEventListener('click', openVideo));
    video.addEventListener('close', stopVideo);
    video.addEventListener('click', (e) => { if (e.target === video) video.close(); });
  }

  const formatNumber = (n) => n.toLocaleString('en-US');
  const countUp = (el) => {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / 1400, 1);
      el.textContent = formatNumber(Math.round(target * (1 - Math.pow(1 - p, 3)))) + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const reveal = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      if (!reduced) entry.target.querySelectorAll('[data-count]').forEach(countUp);
      reveal.unobserve(entry.target);
    });
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach((el) => reveal.observe(el));

  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
})();
