(function () {
  'use strict';

  var desktopQuery = window.matchMedia('(min-width: 1024px)');

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function initNavigation() {
    var toggle = document.querySelector('[data-nav-toggle]');
    var nav = document.querySelector('[data-site-nav]');
    if (!toggle || !nav) {
      return;
    }
    var closeButton = nav.querySelector('[data-nav-close]');
    var backdrop = document.querySelector('[data-nav-backdrop]');

    function isOpen() {
      return nav.classList.contains('is-open');
    }

    function setOpen(open, returnFocus) {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('nav-open', open);
      if (backdrop) {
        backdrop.hidden = !open;
      }
      if (open) {
        var first = nav.querySelector('.site-nav__link');
        (closeButton || first || nav).focus();
      } else if (returnFocus) {
        toggle.focus();
      }
    }

    toggle.addEventListener('click', function () {
      setOpen(!isOpen(), false);
    });
    if (closeButton) {
      closeButton.addEventListener('click', function () {
        setOpen(false, true);
      });
    }
    if (backdrop) {
      backdrop.addEventListener('click', function () {
        setOpen(false, true);
      });
    }

    // Section links on the one-page home scroll in place, so the drawer must close itself.
    nav.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        if (isOpen()) {
          setOpen(false, false);
        }
      });
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen()) {
        setOpen(false, true);
        return;
      }
      if (event.key !== 'Tab' || !isOpen() || desktopQuery.matches) {
        return;
      }
      var focusable = Array.prototype.filter.call(nav.querySelectorAll('a, button'), function (element) {
        return element.offsetParent !== null;
      });
      if (!focusable.length) {
        return;
      }
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    desktopQuery.addEventListener('change', function (event) {
      if (event.matches && isOpen()) {
        setOpen(false, false);
      }
    });
  }

  function initScrollHeader() {
    var header = document.querySelector('[data-site-header]');
    var backToTop = document.querySelector('[data-back-to-top]');
    if (!header && !backToTop) {
      return;
    }
    var ticking = false;

    function update() {
      ticking = false;
      var y = window.scrollY || window.pageYOffset;
      if (header) {
        header.classList.toggle('is-scrolled', y > 40);
      }
      if (backToTop) {
        backToTop.hidden = y < window.innerHeight * 0.8;
      }
    }

    window.addEventListener('scroll', function () {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    }, { passive: true });
    update();
  }

  function initScrollSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('[data-section-link]'));
    if (!links.length || !('IntersectionObserver' in window)) {
      return;
    }
    var byId = {};
    links.forEach(function (link) {
      var id = link.getAttribute('data-section-link');
      var section = document.getElementById(id);
      if (section) {
        (byId[id] = byId[id] || []).push(link);
      }
    });
    var ids = Object.keys(byId);
    if (!ids.length) {
      return;
    }

    function mark(activeId) {
      links.forEach(function (link) {
        var active = link.getAttribute('data-section-link') === activeId;
        link.classList.toggle('is-current', active);
        if (active) {
          link.setAttribute('aria-current', 'location');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    }

    var visible = {};
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        visible[entry.target.id] = entry.isIntersecting;
      });
      var current = ids.filter(function (id) {
        return visible[id];
      });
      mark(current.length ? current[0] : '');
    }, { rootMargin: '-45% 0px -50% 0px', threshold: 0 });

    ids.forEach(function (id) {
      observer.observe(document.getElementById(id));
    });
  }

  function initSubnav() {
    var items = Array.prototype.slice.call(document.querySelectorAll('[data-subnav]'));
    if (!items.length) {
      return;
    }

    function setExpanded(item, expanded) {
      item.classList.toggle('is-expanded', expanded);
      var button = item.querySelector('[data-subnav-toggle]');
      if (button) {
        button.setAttribute('aria-expanded', String(expanded));
      }
    }

    items.forEach(function (item) {
      var button = item.querySelector('[data-subnav-toggle]');
      if (!button) {
        return;
      }
      button.addEventListener('click', function () {
        var expanded = !item.classList.contains('is-expanded');
        if (desktopQuery.matches) {
          items.forEach(function (other) {
            if (other !== item) {
              setExpanded(other, false);
            }
          });
        }
        setExpanded(item, expanded);
      });
      item.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && item.classList.contains('is-expanded')) {
          event.stopPropagation();
          setExpanded(item, false);
          button.focus();
        }
      });
      item.addEventListener('focusout', function (event) {
        if (desktopQuery.matches && !item.contains(event.relatedTarget)) {
          setExpanded(item, false);
        }
      });
    });

    document.addEventListener('click', function (event) {
      if (!desktopQuery.matches) {
        return;
      }
      items.forEach(function (item) {
        if (!item.contains(event.target)) {
          setExpanded(item, false);
        }
      });
    });

    desktopQuery.addEventListener('change', function () {
      items.forEach(function (item) {
        setExpanded(item, false);
      });
    });
  }

  function initHeroSlider() {
    var root = document.querySelector('[data-hero-slider]');
    if (!root) {
      return;
    }
    var slides = Array.prototype.slice.call(root.querySelectorAll('[data-slide]'));
    var dots = Array.prototype.slice.call(root.querySelectorAll('[data-slide-dot]'));
    var pauseButton = root.querySelector('[data-slide-pause]');
    if (slides.length < 2) {
      return;
    }
    var interval = Math.max(3, Number(root.getAttribute('data-interval')) || 7) * 1000;
    var index = 0;
    var timer = null;
    var hovered = false;
    var stopped = false;

    function show(next) {
      slides[index].setAttribute('aria-hidden', 'true');
      slides[index].inert = true;
      slides[index].classList.remove('is-active');
      if (dots[index]) {
        dots[index].classList.remove('is-active');
        dots[index].removeAttribute('aria-current');
      }
      index = (next + slides.length) % slides.length;
      var image = slides[index].querySelector('img[loading="lazy"]');
      if (image) {
        image.loading = 'eager';
      }
      slides[index].removeAttribute('aria-hidden');
      slides[index].inert = false;
      slides[index].classList.add('is-active');
      if (dots[index]) {
        dots[index].classList.add('is-active');
        dots[index].setAttribute('aria-current', 'true');
      }
    }

    function start() {
      window.clearInterval(timer);
      timer = null;
      if (reducedMotion.matches || hovered || stopped) {
        return;
      }
      timer = window.setInterval(function () {
        if (!document.hidden) {
          show(index + 1);
        }
      }, interval);
    }

    function setStopped(value) {
      stopped = value;
      if (pauseButton) {
        pauseButton.setAttribute('aria-pressed', String(value));
        var icon = pauseButton.querySelector('[data-pause-icon]');
        var label = pauseButton.querySelector('.visually-hidden');
        if (icon) {
          icon.textContent = value ? 'play_arrow' : 'pause';
        }
        if (label) {
          label.textContent = value ? 'Play slideshow' : 'Pause slideshow';
        }
      }
      start();
    }

    root.querySelector('[data-slide-prev]').addEventListener('click', function () {
      show(index - 1);
      start();
    });
    root.querySelector('[data-slide-next]').addEventListener('click', function () {
      show(index + 1);
      start();
    });
    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        show(Number(dot.getAttribute('data-slide-dot')));
        start();
      });
    });
    if (pauseButton) {
      if (reducedMotion.matches) {
        setStopped(true);
      }
      pauseButton.addEventListener('click', function () {
        setStopped(!stopped);
      });
    }

    var touchX = null;
    root.addEventListener('touchstart', function (event) {
      touchX = event.touches[0].clientX;
    }, { passive: true });
    root.addEventListener('touchend', function (event) {
      if (touchX === null) {
        return;
      }
      var delta = event.changedTouches[0].clientX - touchX;
      touchX = null;
      if (Math.abs(delta) > 50) {
        show(delta < 0 ? index + 1 : index - 1);
        start();
      }
    }, { passive: true });

    // Rotation pauses while a visitor is pointing at or using the slider.
    root.addEventListener('mouseenter', function () {
      hovered = true;
      start();
    });
    root.addEventListener('mouseleave', function () {
      hovered = false;
      start();
    });
    root.addEventListener('focusin', function () {
      hovered = true;
      start();
    });
    root.addEventListener('focusout', function (event) {
      if (!root.contains(event.relatedTarget)) {
        hovered = false;
        start();
      }
    });
    reducedMotion.addEventListener('change', start);
    start();
  }

  function initDonationPresets() {
    var form = document.querySelector('[data-donation-form]');
    if (!form) {
      return;
    }
    var input = form.querySelector('[name="amount"]');
    var presets = Array.prototype.slice.call(form.querySelectorAll('[data-amount]'));
    if (!input || !presets.length) {
      return;
    }

    function sync() {
      var value = input.value.replace(/[\s,]/g, '');
      presets.forEach(function (preset) {
        preset.setAttribute('aria-pressed', String(preset.getAttribute('data-amount') === value));
      });
    }

    presets.forEach(function (preset) {
      preset.addEventListener('click', function () {
        input.value = preset.getAttribute('data-amount');
        sync();
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
    });
    input.addEventListener('input', sync);
    form.addEventListener('reset', function () {
      window.setTimeout(sync, 0);
    });
    sync();
  }

  function setFieldError(form, name, message) {
    var field = form.querySelector('[name="' + name + '"]');
    var holder = form.querySelector('[data-error-for="' + name + '"]');
    if (!field || !holder) {
      return;
    }
    var wrapper = field.closest('.form-field');
    holder.textContent = message || '';
    if (wrapper) {
      wrapper.classList.toggle('is-invalid', Boolean(message));
    }
    if (message) {
      field.setAttribute('aria-invalid', 'true');
      field.setAttribute('aria-describedby', holder.id);
    } else {
      field.removeAttribute('aria-invalid');
      field.removeAttribute('aria-describedby');
    }
  }

  function initContactForms() {
    if (!window.fetch) {
      return;
    }
    document.querySelectorAll('[data-contact-form]').forEach(initContactForm);
  }

  function initContactForm(form) {
    var status = form.querySelector('[data-form-status]');
    var submit = form.querySelector('[type="submit"]');
    var names = Array.prototype.map.call(form.querySelectorAll('[data-error-for]'), function (holder) {
      return holder.getAttribute('data-error-for');
    });

    function showStatus(kind, message) {
      status.hidden = false;
      status.className = 'form-status is-' + kind;
      status.textContent = message;
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      names.forEach(function (name) {
        setFieldError(form, name, '');
      });
      submit.disabled = true;
      submit.setAttribute('aria-busy', 'true');
      submit.textContent = 'Sending…';

      fetch(form.action, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(new FormData(form)).toString(),
        credentials: 'same-origin'
      })
        .then(function (response) {
          return response.json().then(function (data) {
            return { ok: response.ok, data: data };
          });
        })
        .then(function (result) {
          if (result.ok && result.data.success) {
            form.reset();
            showStatus('success', result.data.message);
            return;
          }
          var fields = result.data.fields || {};
          Object.keys(fields).forEach(function (name) {
            setFieldError(form, name, fields[name]);
          });
          showStatus('error', result.data.message || 'Your request could not be sent. Please try again.');
          var firstInvalid = form.querySelector('[aria-invalid="true"]');
          if (firstInvalid) {
            firstInvalid.focus();
          }
        })
        .catch(function () {
          showStatus('error', 'Your request could not be sent. Check your connection and try again.');
        })
        .finally(function () {
          submit.disabled = false;
          submit.removeAttribute('aria-busy');
          submit.textContent = submit.getAttribute('data-submit-label') || 'Submit';
        });
    });
  }

  function initLightbox() {
    var dialog = document.querySelector('[data-lightbox]');
    var items = Array.prototype.slice.call(document.querySelectorAll('[data-gallery-item]'));
    if (!dialog || !items.length || typeof dialog.showModal !== 'function') {
      return;
    }
    var image = dialog.querySelector('[data-lightbox-image]');
    var caption = dialog.querySelector('[data-lightbox-caption]');
    var prev = dialog.querySelector('[data-lightbox-prev]');
    var next = dialog.querySelector('[data-lightbox-next]');
    var index = 0;

    function show(position) {
      index = (position + items.length) % items.length;
      var item = items[index];
      var thumb = item.querySelector('img');
      image.src = item.getAttribute('href');
      image.alt = thumb ? thumb.alt : '';
      caption.textContent = item.getAttribute('data-caption') || '';
    }

    prev.hidden = items.length < 2;
    next.hidden = items.length < 2;

    items.forEach(function (item, position) {
      item.addEventListener('click', function (event) {
        event.preventDefault();
        show(position);
        dialog.showModal();
      });
    });

    dialog.addEventListener('close', function () {
      items[index].focus();
    });
    dialog.querySelector('[data-lightbox-close]').addEventListener('click', function () {
      dialog.close();
    });
    prev.addEventListener('click', function () {
      show(index - 1);
    });
    next.addEventListener('click', function () {
      show(index + 1);
    });
    dialog.addEventListener('click', function (event) {
      if (event.target === dialog) {
        dialog.close();
      }
    });
    dialog.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        dialog.close();
      } else if (event.key === 'ArrowLeft') {
        show(index - 1);
      } else if (event.key === 'ArrowRight') {
        show(index + 1);
      }
    });
  }

  function initPageBar() {
    var bar = document.querySelector('[data-page-bar]');
    var hero = document.querySelector('.page-hero');
    if (!bar || !hero || !('IntersectionObserver' in window)) {
      return;
    }
    var links = bar.querySelectorAll('a');

    function setVisible(visible) {
      bar.classList.toggle('is-visible', visible);
      bar.setAttribute('aria-hidden', String(!visible));
      links.forEach(function (link) {
        if (visible) {
          link.removeAttribute('tabindex');
        } else {
          link.setAttribute('tabindex', '-1');
        }
      });
    }

    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        setVisible(!entry.isIntersecting);
      });
    }, { rootMargin: '-80px 0px 0px 0px', threshold: 0 });
    observer.observe(hero);
  }

  function initContactMap() {
    var root = document.querySelector('[data-contact-map]');
    if (!root) {
      return;
    }
    var tabs = Array.prototype.slice.call(root.querySelectorAll('[role="tab"]'));
    var frame = root.querySelector('[data-map-frame]');
    var iframe = root.querySelector('[data-map-iframe]');

    function select(tab, focus) {
      tabs.forEach(function (other) {
        var active = other === tab;
        other.classList.toggle('is-active', active);
        other.setAttribute('aria-selected', String(active));
        other.setAttribute('tabindex', active ? '0' : '-1');
        var panel = document.getElementById(other.getAttribute('aria-controls'));
        if (panel) {
          panel.hidden = !active;
        }
      });
      var src = tab.getAttribute('data-map-src');
      if (frame && iframe) {
        frame.hidden = !src;
        if (src && iframe.getAttribute('src') !== src) {
          iframe.setAttribute('src', src);
        }
      }
      if (focus) {
        tab.focus();
      }
    }

    tabs.forEach(function (tab, index) {
      tab.addEventListener('click', function () {
        select(tab, false);
      });
      tab.addEventListener('keydown', function (event) {
        var target = null;
        if (event.key === 'ArrowRight') {
          target = tabs[(index + 1) % tabs.length];
        } else if (event.key === 'ArrowLeft') {
          target = tabs[(index - 1 + tabs.length) % tabs.length];
        } else if (event.key === 'Home') {
          target = tabs[0];
        } else if (event.key === 'End') {
          target = tabs[tabs.length - 1];
        }
        if (target) {
          event.preventDefault();
          select(target, true);
        }
      });
    });
  }

  function bindHeroVideo(video) {
    video.addEventListener('playing', function () {
      video.classList.add('is-playing');
    });
  }

  function playHeroVideo(video) {
    if (!video) {
      return Promise.resolve(false);
    }
    if (reducedMotion.matches) {
      stopHeroVideo(video);
      return Promise.resolve(false);
    }
    window.clearTimeout(video.rewindTimer);
    if (video.preload === 'none') {
      video.preload = 'auto';
    }
    // Show the frame immediately so the slide fade is the only transition.
    video.classList.add('is-playing');
    var attempt = video.play();
    if (attempt && typeof attempt.then === 'function') {
      return attempt.then(function () {
        return true;
      }).catch(function () {
        video.classList.remove('is-playing');
        return false;
      });
    }
    return Promise.resolve(true);
  }

  function stopHeroVideo(video, reset) {
    if (!video) {
      return;
    }
    window.clearTimeout(video.rewindTimer);
    video.rewindTimer = null;
    video.pause();
    if (reset) {
      // Hold the last frame through the slide fade, then rewind while the slide is hidden.
      video.rewindTimer = window.setTimeout(function () {
        video.rewindTimer = null;
        try {
          video.currentTime = 0;
        } catch (error) {
          // The file may not be seekable yet. The next play() starts at the beginning once it is.
        }
      }, 900);
    }
    if (reducedMotion.matches) {
      video.classList.remove('is-playing');
    }
  }

  function initPageHeroVideo() {
    var video = document.querySelector('.page-hero [data-hero-video]');
    if (!video) {
      return;
    }
    bindHeroVideo(video);
    playHeroVideo(video);
    reducedMotion.addEventListener('change', function () {
      if (reducedMotion.matches) {
        stopHeroVideo(video);
      } else {
        playHeroVideo(video);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    initNavigation();
    initScrollHeader();
    initScrollSpy();
    initSubnav();
    initHeroSlider();
    initDonationPresets();
    initPageHeroVideo();
    initContactMap();
    initContactForms();
    initLightbox();
    initPageBar();
  });
})();
