(function () {
  'use strict';

  var desktopQuery = window.matchMedia('(min-width: 1024px)');

  function initNavigation() {
    var toggle = document.querySelector('[data-nav-toggle]');
    var nav = document.querySelector('[data-site-nav]');
    if (!toggle || !nav) {
      return;
    }
    var icon = toggle.querySelector('[data-nav-icon]');

    function setOpen(open) {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
      document.body.classList.toggle('nav-open', open);
      if (icon) {
        icon.textContent = open ? 'close' : 'menu';
      }
    }

    toggle.addEventListener('click', function () {
      setOpen(!nav.classList.contains('is-open'));
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        if (nav.classList.contains('is-open')) {
          setOpen(false);
          toggle.focus();
        }
        nav.querySelectorAll('.is-expanded').forEach(function (item) {
          item.classList.remove('is-expanded');
          var button = item.querySelector('[data-submenu-toggle]');
          if (button) {
            button.setAttribute('aria-expanded', 'false');
          }
        });
      }
    });

    nav.querySelectorAll('[data-submenu-toggle]').forEach(function (button) {
      button.addEventListener('click', function () {
        var item = button.closest('.site-nav__item');
        var expanded = !item.classList.contains('is-expanded');
        item.classList.toggle('is-expanded', expanded);
        button.setAttribute('aria-expanded', String(expanded));
      });
    });

    desktopQuery.addEventListener('change', function (event) {
      if (event.matches) {
        setOpen(false);
      }
    });
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

  function initContactForm() {
    var form = document.querySelector('[data-contact-form]');
    if (!form || !window.fetch) {
      return;
    }
    var status = form.querySelector('[data-form-status]');
    var submit = form.querySelector('[type="submit"]');
    var names = ['name', 'email', 'company', 'phone', 'topic', 'message'];

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
      if (event.key === 'ArrowLeft') {
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

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

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

  function initHeroSlider() {
    var root = document.querySelector('[data-hero-slider]');
    if (!root) {
      return;
    }
    var slides = Array.prototype.slice.call(root.querySelectorAll('[data-slide]'));
    var dots = Array.prototype.slice.call(root.querySelectorAll('[data-slide-dot]'));
    var track = root.querySelector('[data-slider-track]');
    var prev = root.querySelector('[data-slider-prev]');
    var next = root.querySelector('[data-slider-next]');
    var toggle = root.querySelector('[data-slider-toggle]');
    var toggleIcon = root.querySelector('[data-slider-toggle-icon]');
    var interval = 7000;
    var index = 0;
    var timer = null;
    var userPaused = false;
    var touchStartX = null;
    var advanceWhenReady = false;

    function videoOf(slide) {
      return slide ? slide.querySelector('[data-hero-video]') : null;
    }

    // A video slide stays up until that video finishes. An image slide keeps the timed interval.
    function waitsForVideo(video) {
      return Boolean(video) && !reducedMotion.matches && !video.dataset.playbackFailed;
    }

    slides.forEach(function (slide) {
      var video = videoOf(slide);
      if (!video) {
        return;
      }
      bindHeroVideo(video);
      video.loop = slides.length < 2;
      video.addEventListener('ended', function () {
        if (videoOf(slides[index]) !== video || video.loop) {
          return;
        }
        advanceWhenReady = true;
        schedule();
      });
      video.addEventListener('error', function () {
        video.dataset.playbackFailed = '1';
        if (videoOf(slides[index]) === video) {
          schedule();
        }
      });
    });

    function autoplayAllowed() {
      return slides.length > 1 && !reducedMotion.matches && !userPaused;
    }

    function schedule() {
      window.clearTimeout(timer);
      timer = null;
      if (track) {
        track.setAttribute('aria-live', autoplayAllowed() ? 'off' : 'polite');
      }
      if (!autoplayAllowed() || document.hidden) {
        return;
      }
      if (advanceWhenReady) {
        advanceWhenReady = false;
        show(index + 1);
        return;
      }
      if (waitsForVideo(videoOf(slides[index]))) {
        return;
      }
      timer = window.setTimeout(function () {
        if (document.hidden || !autoplayAllowed()) {
          schedule();
        } else {
          show(index + 1);
        }
      }, interval);
    }

    function syncToggle() {
      if (!toggle) {
        return;
      }
      root.classList.toggle('is-paused', userPaused);
      toggle.setAttribute('aria-pressed', userPaused ? 'true' : 'false');
      toggle.setAttribute('aria-label', userPaused ? 'Play slideshow' : 'Pause slideshow');
      if (toggleIcon) {
        toggleIcon.textContent = userPaused ? 'play_arrow' : 'pause';
      }
    }

    function restartZoom(slide) {
      var media = slide.querySelector('.hero__media');
      if (!media) {
        return;
      }
      var zoom = slide.getAttribute('data-zoom');
      media.classList.remove('is-zooming');
      if (reducedMotion.matches || (zoom !== 'in' && zoom !== 'out')) {
        return;
      }
      // Restart the keyframes from the first frame each time the slide is shown.
      void media.offsetWidth;
      media.classList.add('is-zooming');
    }

    function show(target) {
      advanceWhenReady = false;
      index = (target + slides.length) % slides.length;
      slides.forEach(function (slide, position) {
        var active = position === index;
        var wasActive = slide.classList.contains('is-active');
        var video = videoOf(slide);
        slide.classList.toggle('is-active', active);
        slide.inert = !active;
        if (active) {
          slide.removeAttribute('aria-hidden');
          if (!wasActive || !slide.querySelector('.hero__media.is-zooming')) {
            restartZoom(slide);
          }
          if (video) {
            delete video.dataset.playbackFailed;
            playHeroVideo(video).then(function (started) {
              if (started || videoOf(slides[index]) !== video) {
                return;
              }
              video.dataset.playbackFailed = '1';
              schedule();
            });
          }
        } else {
          slide.setAttribute('aria-hidden', 'true');
          stopHeroVideo(video, true);
        }
      });
      dots.forEach(function (dot, position) {
        var active = position === index;
        dot.classList.toggle('is-active', active);
        if (active) {
          dot.setAttribute('aria-current', 'true');
        } else {
          dot.removeAttribute('aria-current');
        }
      });
      schedule();
    }

    if (prev) {
      prev.addEventListener('click', function () {
        show(index - 1);
      });
    }
    if (next) {
      next.addEventListener('click', function () {
        show(index + 1);
      });
    }
    dots.forEach(function (dot, position) {
      dot.addEventListener('click', function () {
        show(position);
      });
    });
    if (toggle) {
      toggle.addEventListener('click', function () {
        userPaused = !userPaused;
        var video = videoOf(slides[index]);
        if (userPaused) {
          stopHeroVideo(video);
        } else if (video && !reducedMotion.matches) {
          playHeroVideo(video);
        }
        syncToggle();
        schedule();
      });
    }

    root.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowLeft') {
        show(index - 1);
      } else if (event.key === 'ArrowRight') {
        show(index + 1);
      }
    });
    root.addEventListener('touchstart', function (event) {
      touchStartX = event.touches.length === 1 ? event.touches[0].clientX : null;
    }, { passive: true });
    root.addEventListener('touchend', function (event) {
      if (touchStartX === null || slides.length < 2) {
        return;
      }
      var deltaX = event.changedTouches[0].clientX - touchStartX;
      touchStartX = null;
      if (Math.abs(deltaX) > 50) {
        show(deltaX < 0 ? index + 1 : index - 1);
      }
    }, { passive: true });

    document.addEventListener('visibilitychange', function () {
      var video = videoOf(slides[index]);
      if (document.hidden) {
        stopHeroVideo(video);
      } else if (video && !video.ended && !userPaused) {
        playHeroVideo(video);
      }
      schedule();
    });
    reducedMotion.addEventListener('change', function () {
      if (reducedMotion.matches) {
        slides.forEach(function (slide) {
          var media = slide.querySelector('.hero__media');
          if (media) {
            media.classList.remove('is-zooming');
          }
        });
      }
      syncToggle();
      show(index);
    });

    syncToggle();
    show(0);
  }

  document.addEventListener('DOMContentLoaded', function () {
    initHeroSlider();
    initPageHeroVideo();
    initContactMap();
    initNavigation();
    initContactForm();
    initLightbox();
    initPageBar();
  });
})();
