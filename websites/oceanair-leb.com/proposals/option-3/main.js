(() => {
  document.documentElement.classList.remove('no-js');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const header = document.querySelector('[data-header]');
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 40);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const toggle = document.querySelector('[data-nav-toggle]');
  const menu = document.querySelector('[data-nav-menu]');
  const subs = [...document.querySelectorAll('[data-sub]')];
  const setSub = (sub, open) => {
    sub.classList.toggle('is-open', open);
    sub.querySelector('[data-sub-toggle]').setAttribute('aria-expanded', String(open));
  };
  const setMenu = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    menu.classList.toggle('is-open', open);
    if (!open) subs.forEach((s) => setSub(s, false));
  };
  toggle.addEventListener('click', () => setMenu(toggle.getAttribute('aria-expanded') !== 'true'));

  subs.forEach((sub) => {
    sub.querySelector('[data-sub-toggle]').addEventListener('click', (e) => {
      e.stopPropagation();
      setSub(sub, !sub.classList.contains('is-open'));
    });
  });
  const desktop = window.matchMedia('(min-width: 961px)');
  subs.forEach((sub) => {
    sub.addEventListener('focusout', (e) => {
      if (desktop.matches && !sub.contains(e.relatedTarget)) setSub(sub, false);
    });
  });
  document.addEventListener('click', (e) => {
    if (desktop.matches) subs.forEach((s) => { if (!s.contains(e.target)) setSub(s, false); });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const openSub = subs.find((s) => s.classList.contains('is-open'));
    if (openSub) {
      setSub(openSub, false);
      openSub.querySelector('[data-sub-toggle]').focus();
      return;
    }
    setMenu(false);
  });

  const slides = [...document.querySelectorAll('[data-slides] .slide')];
  const dotsWrap = document.querySelector('[data-dots]');
  if (slides.length > 1 && dotsWrap) {
    let index = 0;
    let timer;
    const dots = slides.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', `Photo ${i + 1}`);
      b.addEventListener('click', () => { show(i); restart(); });
      dotsWrap.append(b);
      return b;
    });
    const show = (i) => {
      index = i;
      slides.forEach((s, n) => s.classList.toggle('is-active', n === i));
      dots.forEach((d, n) => d.setAttribute('aria-current', String(n === i)));
    };
    const restart = () => {
      window.clearInterval(timer);
      if (!reduced) timer = window.setInterval(() => show((index + 1) % slides.length), 6500);
    };
    show(0);
    restart();
    document.addEventListener('visibilitychange', () => (document.hidden ? window.clearInterval(timer) : restart()));
  }

  document.querySelectorAll('[data-tabs]').forEach((group) => {
    const tabs = [...group.querySelectorAll('[role="tab"]')];
    const select = (tab, focus) => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
      });
      if (focus) tab.focus();
    };
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        select(tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length], true);
      });
    });
  });

  const trackMessage = (form, ref) => {
    form.querySelector('.track-msg').textContent = `Searching for "${ref}"… (design preview: connects to the WWA tracking system on the live site)`;
  };
  document.querySelectorAll('[data-track-form]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      trackMessage(form, form.elements.ref.value.trim());
    });
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) {
      form.elements.ref.value = ref;
      trackMessage(form, ref);
    }
  });

  document.querySelectorAll('[data-demo-form]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      form.querySelector('.form-msg').textContent = form.dataset.msg || 'Thank you. This is a design preview, so nothing was sent.';
    });
  });

  const dialog = document.getElementById('inquiry');
  if (dialog) {
    document.querySelectorAll('[data-open-inquiry]').forEach((btn) => {
      btn.addEventListener('click', () => {
        setMenu(false);
        dialog.querySelector('.form-msg').textContent = '';
        dialog.showModal();
      });
    });
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  }

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

  const countUp = (el) => {
    const target = Number(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const start = performance.now();
    const step = (now) => {
      const p = Math.min((now - start) / 1400, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))).toLocaleString('en-US') + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const reveal = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      if (!reduced) entry.target.querySelectorAll('[data-count]').forEach(countUp);
      reveal.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => reveal.observe(el));

  document.querySelectorAll('[data-year]').forEach((el) => { el.textContent = String(new Date().getFullYear()); });
})();
