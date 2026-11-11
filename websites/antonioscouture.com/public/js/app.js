/**
 * Modern JavaScript for Russian Orthodox Church Website
 * No Mootools dependencies - using vanilla JavaScript and jQuery
 */

(function() {
  'use strict';

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    initSmoothScrolling();
    initScrollAnimations();
    initPageLoader();
    initMobileMenu();
    initBackToTop();
    initNeedHelpChat();
    initFancybox();
    initCustomHeaderMenu(); // Added for custom header logic
  }

  /**
   * Smooth Scrolling for anchor links
   */
  function initSmoothScrolling() {
    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        const href = this.getAttribute('href');

        // Action links (cart, wishlist, etc.) use href="#"; let app.js / page scripts handle them.
        if (this.classList.contains('add-to-cart-btn') || this.classList.contains('add-to-wishlist-btn')) {
          return;
        }
        if (this.getAttribute('data-no-smooth-scroll') === 'true') {
          return;
        }
        
        // Skip if it's just "#"
        if (href === '#' || href === '#!') {
          e.preventDefault();
          return;
        }

        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          const offsetTop = target.offsetTop - 80; // Account for fixed header
          
          window.scrollTo({
            top: offsetTop,
            behavior: 'smooth'
          });
        }
      });
    });

    // Add smooth scroll behavior to CSS
    if (!document.querySelector('style[data-smooth-scroll]')) {
      const style = document.createElement('style');
      style.setAttribute('data-smooth-scroll', 'true');
      style.textContent = `
        html {
          scroll-behavior: smooth;
        }
      `;
      document.head.appendChild(style);
    }
  }

  /**
   * Scroll Animations - Fade in elements on scroll
   */
  function initScrollAnimations() {
    // Only run if IntersectionObserver is supported
    if (typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('fade-in');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    // Observe elements with animation class or specific sections
    const animateElements = document.querySelectorAll(
      '.module, .booking_btn, .photos, .content-section > .container > .row > div'
    );

    animateElements.forEach(el => {
      observer.observe(el);
    });
  }

  /**
   * Page Loader - Hide loader when page is ready
   */
  function initPageLoader() {
    const loader = document.getElementById('pageLoader');
    if (!loader) return;

    // Hide loader when page is fully loaded
    if (document.readyState === 'complete') {
      hideLoader();
    } else {
      window.addEventListener('load', hideLoader);
    }

    function hideLoader() {
      setTimeout(() => {
        if (loader) {
          loader.classList.add('loaded');
          // Remove from DOM after animation
          setTimeout(() => {
            if (loader.parentNode) {
              loader.parentNode.removeChild(loader);
            }
          }, 500);
        }
      }, 300);
    }
  }

  /**
   * Mobile Menu Enhancements - Offcanvas slide-in menu
   */
  function initMobileMenu() {
    const navbarToggler = document.querySelector('.navbar-toggler');
    const mobileMenu = document.getElementById('mobileMenu');

    if (!navbarToggler || !mobileMenu) return;

    // Close mobile menu when clicking a link
    const mobileMenuLinks = mobileMenu.querySelectorAll('.nav-link:not(.dropdown-toggle), .dropdown-item');
    mobileMenuLinks.forEach(link => {
      link.addEventListener('click', function() {
        if (window.innerWidth < 992) { // Bootstrap lg breakpoint
          const bsOffcanvas = bootstrap.Offcanvas.getInstance(mobileMenu);
          if (bsOffcanvas) {
            bsOffcanvas.hide();
          }
        }
      });
    });

    // Handle backdrop click to close menu
    mobileMenu.addEventListener('hidden.bs.offcanvas', function() {
      // Menu is now closed
    });
  }

  /**
   * Footer back to top only (#footerTopButton); layout uses Need Help chat instead of .back-to-top.
   */
  function initBackToTop() {
    const backToTopButton = document.getElementById('footerTopButton');
    if (backToTopButton) {
      function toggleFooterBackToTop() {
        if (window.pageYOffset > 300) {
          backToTopButton.style.display = 'inline-flex';
          backToTopButton.style.opacity = '1';
        } else {
          backToTopButton.style.opacity = '0';
          setTimeout(() => {
            if (window.pageYOffset <= 300) {
              backToTopButton.style.display = 'none';
            }
          }, 300);
        }
      }

      backToTopButton.style.display = 'none';
      backToTopButton.style.opacity = '0';
      backToTopButton.style.transition = 'opacity 0.3s ease';

      window.addEventListener('scroll', debounce(toggleFooterBackToTop, 100));

      backToTopButton.addEventListener('click', function(e) {
        e.preventDefault();
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      });

      toggleFooterBackToTop();
    }
  }

  function getOrCreateChatPublicKey() {
    try {
      var STORAGE = 'chat_public_key_v1';
      var existing = window.localStorage.getItem(STORAGE);
      if (existing && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)) {
        return existing;
      }
      var uuid = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            var r = Math.random() * 16 | 0;
            var v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
      window.localStorage.setItem(STORAGE, uuid);
      return uuid;
    } catch (e) {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
    }
  }

  function initNeedHelpChat() {
    var root = document.getElementById('needHelpChatRoot');
    if (!root || typeof window.io !== 'function') return;

    var toggle = document.getElementById('needHelpChatToggle');
    var panel = document.getElementById('needHelpChatPanel');
    var closeBtn = document.getElementById('needHelpChatClose');
    var messagesEl = document.getElementById('needHelpChatMessages');
    var input = document.getElementById('needHelpChatInput');
    var sendBtn = document.getElementById('needHelpChatSend');
    var statusEl = document.getElementById('needHelpChatStatus');
    var fnEl = document.getElementById('needHelpChatFirstName');
    var emEl = document.getElementById('needHelpChatEmail');
    var phEl = document.getElementById('needHelpChatPhone');

    if (!toggle || !panel) return;

    var LABELS = {
      visitor: 'You',
      team: 'Support'
    };
    if (root) {
      LABELS.visitor = root.getAttribute('data-chat-label-visitor') || LABELS.visitor;
      LABELS.team = root.getAttribute('data-chat-label-team') || LABELS.team;
    }

    var publicKey = getOrCreateChatPublicKey();
    var socket = null;
    var opened = false;
    var CONTACT_INTRO_LS = 'chat_contact_intro_done_v1';
    var contactSection = document.getElementById('needHelpChatContactSection');
    var contactFields = document.getElementById('needHelpChatContactFields');
    var turnstileRequired = root.getAttribute('data-turnstile-required') === '1';
    var turnstileResponseInput = document.getElementById('needHelpChatTurnstileResponse');
    var turnstileErrorEl = document.getElementById('needHelpChatTurnstileError');
    var MSG_TURNSTILE = root.getAttribute('data-chat-turnstile-required') || 'Please complete the security verification.';
    var MSG_ERROR_SEND = root.getAttribute('data-chat-error-send') || 'Could not send. Please try again.';
    var chatTurnstileToken = '';

    function contactIntroMarkedDone() {
      try {
        return window.localStorage.getItem(CONTACT_INTRO_LS) === '1';
      } catch (e) {
        return false;
      }
    }

    function syncCompactLayout() {
      if (!root) return;
      var hasMessages = messagesEl && messagesEl.children.length > 0;
      root.classList.toggle('need-help-chat--compact', hasMessages);
    }

    function markContactIntroDone() {
      try {
        window.localStorage.setItem(CONTACT_INTRO_LS, '1');
      } catch (e) {}
      var hasMessages = messagesEl && messagesEl.children.length > 0;
      if (hasMessages && contactSection) {
        contactSection.classList.add('d-none');
      } else if (contactFields) {
        contactFields.classList.add('d-none');
      }
      syncCompactLayout();
    }

    function applyContactIntroVisibility() {
      if (!contactIntroMarkedDone()) {
        syncCompactLayout();
        return;
      }
      var hasMessages = messagesEl && messagesEl.children.length > 0;
      if (hasMessages && contactSection) {
        contactSection.classList.add('d-none');
      } else if (contactFields) {
        contactFields.classList.add('d-none');
      }
      syncCompactLayout();
    }

    applyContactIntroVisibility();

    function setStatus(msg) {
      if (statusEl) statusEl.textContent = msg || '\u00a0';
    }

    function showTurnstileError() {
      if (turnstileErrorEl) turnstileErrorEl.classList.remove('d-none');
    }

    function hideTurnstileError() {
      if (turnstileErrorEl) turnstileErrorEl.classList.add('d-none');
    }

    function getTurnstileToken() {
      if (turnstileResponseInput && turnstileResponseInput.value) {
        return turnstileResponseInput.value;
      }
      return chatTurnstileToken || '';
    }

    function needsTurnstileForSend() {
      if (!turnstileRequired) return false;
      if (!messagesEl) return true;
      return messagesEl.children.length === 0;
    }

    function resetChatTurnstile() {
      chatTurnstileToken = '';
      if (turnstileResponseInput) turnstileResponseInput.value = '';
      if (typeof window.turnstile !== 'undefined' && window.turnstile.reset) {
        try {
          window.turnstile.reset('#needHelpChatTurnstileWidget');
        } catch (e) {}
      }
    }

    window.onChatTurnstileSuccess = function(token) {
      chatTurnstileToken = token || '';
      if (turnstileResponseInput) turnstileResponseInput.value = chatTurnstileToken;
      hideTurnstileError();
      setStatus('');
    };
    window.onChatTurnstileError = function() {
      resetChatTurnstile();
      showTurnstileError();
    };
    window.onChatTurnstileExpired = function() {
      resetChatTurnstile();
      showTurnstileError();
    };

    function appendLine(payload, scrollBottom) {
      if (!messagesEl) return;
      var wrap = document.createElement('div');
      wrap.className = 'need-help-chat__line need-help-chat__line--' + (payload.sender === 'staff' ? 'staff' : 'visitor');
      var who = document.createElement('div');
      who.className = 'need-help-chat__who small text-muted';
      who.textContent = payload.sender === 'staff' ? LABELS.team : LABELS.visitor;
      var body = document.createElement('div');
      body.className = 'need-help-chat__body';
      body.textContent = payload.body;
      wrap.appendChild(who);
      wrap.appendChild(body);
      messagesEl.appendChild(wrap);
      if (scrollBottom !== false) {
        messagesEl.scrollTop = messagesEl.scrollHeight;
      }
    }

    function ensureSocket() {
      if (socket) {
        return;
      }
      socket = window.io({
        path: '/socket.io',
        withCredentials: true,
        transports: ['websocket', 'polling'],
        auth: { publicKey: publicKey }
      });

      socket.on('connect', function() {
        setStatus('');
      });
      socket.on('disconnect', function() {
        setStatus('');
      });
      socket.on('chat:history', function(data) {
        if (!messagesEl || !data || !data.messages) return;
        if (data.messages.length > 0) {
          markContactIntroDone();
        }
        messagesEl.innerHTML = '';
        data.messages.forEach(function(m) {
          appendLine({ sender: m.sender, body: m.body }, false);
        });
        messagesEl.scrollTop = messagesEl.scrollHeight;
        syncCompactLayout();
      });
      socket.on('chat:message', function(msg) {
        if (!msg || msg.publicKey !== publicKey) return;
        appendLine(msg);
        if (msg.sender === 'visitor') {
          setStatus('');
          markContactIntroDone();
        }
      });
      socket.on('connect_error', function() {
        setStatus(MSG_ERROR_SEND);
      });
      socket.on('chat:error', function(err) {
        var code = err && err.code;
        if (code === 'turnstile_required' || code === 'turnstile_failed') {
          setStatus(MSG_TURNSTILE);
          resetChatTurnstile();
          showTurnstileError();
          if (contactSection) contactSection.classList.remove('d-none');
          root.classList.remove('need-help-chat--compact');
          return;
        }
        if (code === 'invalid_body') {
          setStatus(MSG_ERROR_SEND);
          return;
        }
        setStatus(MSG_ERROR_SEND);
      });

      if (socket.connected) {
        pushContactToServer();
      } else {
        socket.once('connect', pushContactToServer);
      }
    }

    function pushContactToServer() {
      if (!socket || !socket.connected) return;
      socket.emit('chat:start', {
        firstName: fnEl && fnEl.value ? fnEl.value.trim() : '',
        email: emEl && emEl.value ? emEl.value.trim() : '',
        phone: phEl && phEl.value ? phEl.value.trim() : ''
      });
    }

    function openPanel() {
      panel.classList.remove('d-none');
      toggle.setAttribute('aria-expanded', 'true');
      opened = true;
      ensureSocket();
    }

    function closePanel() {
      panel.classList.add('d-none');
      toggle.setAttribute('aria-expanded', 'false');
      opened = false;
    }

    toggle.addEventListener('click', function(e) {
      e.preventDefault();
      if (panel.classList.contains('d-none')) openPanel();
      else closePanel();
    });
    if (closeBtn) closeBtn.addEventListener('click', closePanel);

    [fnEl, emEl, phEl].forEach(function(el) {
      if (!el) return;
      el.addEventListener('change', pushContactToServer);
      el.addEventListener('blur', pushContactToServer);
    });

    function buildChatMessagePayload(text) {
      var payload = { body: text };
      if (needsTurnstileForSend()) {
        var tok = getTurnstileToken();
        if (!tok) {
          setStatus(MSG_TURNSTILE);
          showTurnstileError();
          return null;
        }
        payload.turnstileToken = tok;
      }
      return payload;
    }

    function send() {
      if (!input) return;
      var text = input.value.trim();
      if (!text) return;
      var payload = buildChatMessagePayload(text);
      if (!payload) return;
      ensureSocket();
      if (!socket.connected) {
        setStatus('Connecting…');
        socket.once('connect', function() {
          pushContactToServer();
          socket.emit('chat:message', payload);
          if (input) input.value = '';
        });
        return;
      }
      pushContactToServer();
      socket.emit('chat:message', payload);
      if (input) input.value = '';
    }
    if (sendBtn) sendBtn.addEventListener('click', send);
    if (input) {
      input.addEventListener('keydown', function(ev) {
        if (ev.key === 'Enter' && !ev.shiftKey) {
          ev.preventDefault();
          send();
        }
      });
    }
  }

  /**
   * Utility: Debounce function
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Initialize Fancybox for gallery images
   */
  function initFancybox() {
    // Wait for jQuery and Fancybox to be available
    if (typeof jQuery !== 'undefined' && typeof jQuery.fn.fancybox !== 'undefined') {
      jQuery(document).ready(function($) {
        // Initialize Fancybox on gallery links
        $('[data-fancybox="gallery"]').fancybox({
          buttons: [
            'slideShow',
            'thumbs',
            'zoom',
            'fullScreen',
            'close'
          ],
          loop: true,
          protect: true,
          transitionEffect: 'slide',
          transitionDuration: 300
        });

        // PDP main image gallery: delegated so variant-added slides work; grouped next/prev in lightbox.
        var $pdpGalleryRoot = $('#product-gallery-root');
        if ($pdpGalleryRoot.length) {
          $pdpGalleryRoot.fancybox({
            selector: '[data-fancybox="product-detail-gallery"]',
            loop: true,
            protect: true,
            infobar: true,
            buttons: ['slideShow', 'zoom', 'fullScreen', 'close'],
            transitionEffect: 'slide',
            transitionDuration: 300
          });
        }
      });
    }
  }

  /**
   * Handle window resize for responsive adjustments
   */
  window.addEventListener('resize', debounce(function() {
    // Add any responsive adjustments here if needed
  }, 250));

  /**
   * Custom Header Mobile Menu logic (Slide from left)
   */
  function initCustomHeaderMenu() {
    const toggler = document.querySelector('.navbar-toggler');
    const collapse = document.querySelector('#navbarCollapse');
    const backdrop = document.querySelector('.mobile-menu-backdrop');
    const closeBtn = document.querySelector('.close-mobile-menu');

    function toggleMenu() {
        if (!collapse || !backdrop) return;
        
        if (collapse.classList.contains('show')) {
            collapse.classList.remove('show');
            backdrop.classList.remove('show');
            document.body.style.overflow = '';
        } else {
            collapse.classList.add('show');
            backdrop.classList.add('show');
            document.body.style.overflow = 'hidden';
        }
    }

    if(toggler) {
        toggler.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            toggleMenu();
        });
    }

    if(backdrop) {
        backdrop.addEventListener('click', toggleMenu);
    }

    if(closeBtn) {
        closeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            toggleMenu();
        });
    }
    
    // Mobile dropdown animations - handle clicks on dropdown toggles
    const dropdownToggles = document.querySelectorAll('.mobile-menu-slide .dropdown-toggle');
    
    dropdownToggles.forEach(toggle => {
        toggle.addEventListener('click', function(e) {
            // Only handle on mobile
            if (window.innerWidth >= 992) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const parent = this.closest('.dropdown');
            if (!parent) return;
            
            // For mega menu items, target mobile-simple-dropdown; otherwise target regular dropdown-menu (but not mega-menu-dropdown)
            let dropdownMenu;
            if (parent.classList.contains('mega-menu-item')) {
                dropdownMenu = parent.querySelector('.mobile-simple-dropdown');
            } else {
                dropdownMenu = parent.querySelector('.dropdown-menu:not(.mega-menu-dropdown)');
            }
            
            const arrow = this.querySelector('.fa-angle-down');
            
            if (!dropdownMenu) return;
            
            // Toggle dropdown
            const isOpen = dropdownMenu.classList.contains('show');
            
            // Close all dropdowns first
            document.querySelectorAll('.mobile-menu-slide .dropdown-menu.show, .mobile-menu-slide .mobile-simple-dropdown.show').forEach(menu => {
                menu.classList.remove('show');
            });
            document.querySelectorAll('.mobile-menu-slide .fa-angle-down').forEach(arr => {
                arr.style.transform = 'rotate(0deg)';
            });
            
            // If it wasn't open, open it
            if (!isOpen) {
                dropdownMenu.classList.add('show');
                if (arrow) arrow.style.transform = 'rotate(180deg)';
            }
        });
    });
  }

})();





/**
 * Site-wide Custom JavaScript
 */
(function ($) {
    "use strict";

    /**
     * Home hero carousel: deferred <source> + play. Bootstrap 4 emits slid.bs.carousel on jQuery only,
     * so this must run after jQuery/Bootstrap (not inline in the view before those scripts).
     */
    function guessVideoMimeFromSrc(src) {
        if (!src) return "video/mp4";
        var path = String(src).split("?")[0].toLowerCase();
        if (path.endsWith(".webm")) return "video/webm";
        if (path.endsWith(".ogg") || path.endsWith(".ogv")) return "video/ogg";
        return "video/mp4";
    }

    function initHeroCarouselVideo($) {
        var $carousel = $("#header-carousel");
        if (!$carousel.length) return;

        var carousel = $carousel[0];
        var HERO_VIDEO_DELAY_MS = 200;
        var videosReady = false;

        function loadHeroVideo(videoEl) {
            if (!videoEl) return;
            if (videoEl.dataset.loaded === "1") {
                var p1 = videoEl.play();
                if (p1 && typeof p1.catch === "function") p1.catch(function () {});
                return;
            }
            if (videoEl.querySelector("source")) {
                videoEl.dataset.loaded = "1";
                videoEl.load();
                var p0 = videoEl.play();
                if (p0 && typeof p0.catch === "function") p0.catch(function () {});
                return;
            }
            var src = videoEl.getAttribute("data-video-src");
            if (!src) return;
            var source = document.createElement("source");
            source.src = src;
            source.type = guessVideoMimeFromSrc(src);
            videoEl.appendChild(source);
            videoEl.dataset.loaded = "1";
            videoEl.load();
            var p2 = videoEl.play();
            if (p2 && typeof p2.catch === "function") p2.catch(function () {});
        }

        function pauseAllHeroVideos() {
            carousel.querySelectorAll(".hero-carousel-video").forEach(function (v) {
                v.pause();
            });
        }

        function pickVisibleHeroVideo(activeItem) {
            if (!activeItem) return null;
            var list = activeItem.querySelectorAll(".hero-carousel-video");
            if (!list.length) return null;
            if (list.length === 1) return list[0];
            for (var i = 0; i < list.length; i++) {
                var v = list[i];
                var st = window.getComputedStyle(v);
                if (st.display !== "none" && st.visibility !== "hidden") return v;
            }
            return list[0];
        }

        function syncActiveSlideVideo() {
            pauseAllHeroVideos();
            if (!videosReady) return;
            var activeItem = carousel.querySelector(".carousel-item.active");
            var active = pickVisibleHeroVideo(activeItem);
            if (active) loadHeroVideo(active);
        }

        function scheduleFirstSlideVideo() {
            var activeItem = carousel.querySelector(".carousel-item.active");
            var first = pickVisibleHeroVideo(activeItem);
            if (!first) return;
            window.setTimeout(function () {
                loadHeroVideo(first);
            }, 0);
        }

        $carousel.on("slid.bs.carousel", function () {
            syncActiveSlideVideo();
        });

        var resizeTimer = null;
        window.addEventListener("resize", function () {
            if (!videosReady) return;
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = window.setTimeout(function () {
                resizeTimer = null;
                syncActiveSlideVideo();
            }, 150);
        });

        window.setTimeout(function () {
            videosReady = true;
            scheduleFirstSlideVideo();
        }, HERO_VIDEO_DELAY_MS);
    }

    /**
     * Per-slide display time (data-slide-duration-sec on each .carousel-item). Bootstrap 4 uses one global
     * interval, so we disable the built-in cycle (data-interval="false") and advance with a timer.
     */
    function initHeroCarouselSlideIntervals($) {
        var $carousel = $("#header-carousel");
        if (!$carousel.length) return;

        var carousel = $carousel[0];
        var $items = $carousel.find(".carousel-item");
        if (!$items.length) return;

        var cycleTimer = null;
        var paused = false;

        function clearCycle() {
            if (cycleTimer !== null) {
                clearTimeout(cycleTimer);
                cycleTimer = null;
            }
        }

        function scheduleNext() {
            clearCycle();
            if (paused) return;

            var count = $items.length;
            if (count === 0) return;

            var activeEl = carousel.querySelector(".carousel-item.active");
            if (!activeEl) return;

            var sec = parseInt(activeEl.getAttribute("data-slide-duration-sec"), 10);
            if (isNaN(sec) || sec < 1) sec = 5;
            sec = Math.min(600, sec);

            cycleTimer = window.setTimeout(function () {
                cycleTimer = null;
                if (count > 1) {
                    $carousel.carousel("next");
                } else {
                    scheduleNext();
                }
            }, sec * 1000);
        }

        $carousel.on("slid.bs.carousel", function () {
            scheduleNext();
        });

        $carousel.on("mouseenter", function () {
            paused = true;
            clearCycle();
        });
        $carousel.on("mouseleave", function () {
            paused = false;
            scheduleNext();
        });

        scheduleNext();
    }

    $(document).ready(function () {
        initHeroCarouselVideo($);
        initHeroCarouselSlideIntervals($);

        // Category Menu Hover
        const categoryMenu = $('.category-menu-wrapper');
        const navbarVertical = $('#navbar-vertical');

        if (categoryMenu.length && navbarVertical.length) {
            categoryMenu.on('mouseenter', function () {
                if ($(window).width() >= 992) {
                    navbarVertical.collapse('show');
                }
            });
            categoryMenu.on('mouseleave', function () {
                if ($(window).width() >= 992) {
                    navbarVertical.collapse('hide');
                }
            });
        }

        // Navbar Dropdown Hover
        const navbarDropdowns = $('.navbar-nav .nav-item.dropdown');
        if (navbarDropdowns.length) {
            navbarDropdowns.on('mouseenter', function () {
                if ($(window).width() >= 992) {
                    $(this).addClass('show');
                    $(this).find('.dropdown-menu').addClass('show');
                    $('.dropdown-toggle', this).attr('aria-expanded', 'true');
                }
            });
            navbarDropdowns.on('mouseleave', function () {
                if ($(window).width() >= 992) {
                    $(this).removeClass('show');
                    $(this).find('.dropdown-menu').removeClass('show');
                    $('.dropdown-toggle', this).attr('aria-expanded', 'false');
                }
            });
        }
        // Type of user check or other init can go here

        const loginForm = document.getElementById('headerLoginForm');
        if (loginForm) {
            loginForm.addEventListener('submit', function (e) {
                e.preventDefault();
                const formData = new FormData(e.target);
                const errorDiv = document.getElementById('headerLoginError');
                const submitBtn = e.target.querySelector('button[type="submit"]');

                // Reset error
                errorDiv.classList.add('d-none');
                errorDiv.textContent = '';
                submitBtn.disabled = true;

                fetch('/api/customer/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': formData.get('_csrf')
                    },
                    body: JSON.stringify({
                        email: formData.get('email'),
                        password: formData.get('password'),
                        _csrf: formData.get('_csrf'),
                        skip_turnstile: true
                    })
                })
                    .then(response => response.json())
                    .then(data => {
                        if (data.success) {
                            window.location.href = '/customer/account';
                        } else {
                            // Redirect to login page on invalid credentials (header form has no turnstile)
                            window.location.href = '/customer/login?error=' + encodeURIComponent(data.error || 'Invalid credentials');
                        }
                    })
                    .catch(error => {
                        console.error('Error:', error);
                        errorDiv.textContent = 'An error occurred. Please try again.';
                        errorDiv.classList.remove('d-none');
                        submitBtn.disabled = false;
                    });
            });
        }

        // Logout Handler
        const logoutBtn = document.getElementById('headerLogoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function () {
                console.log('Header logout clicked');
                // Get CSRF token from the login form input if available, or use EJS if possible
                const csrfInput = document.querySelector('input[name="_csrf"]');
                // If the user provided script relied on EJS interpolation ('<%= ... %>'), it won't work in a .js file directly.
                // We need a fallback or a way to get the token.
                // The provided script had: const csrfToken = csrfInput ? csrfInput.value : '<%= typeof csrfToken !== "undefined" ? csrfToken : "" %>';
                // Since this is a .js file, we can't use EJS. We should rely on a meta tag or input on the page.
                // Assuming there might be a meta tag or we can only use the input. 
                // Best practice is to have a meta tag for csrf.
                // For now, I'll rely on the input if it exists, or check a global variable if one was set.
                // I will modify the logic to be safe for a JS file.

                let csrfToken = '';
                if (csrfInput) {
                    csrfToken = csrfInput.value;
                } else {
                    // Try to find it in meta tag
                    const metaCsrf = document.querySelector('meta[name="csrf-token"]');
                    if (metaCsrf) {
                        csrfToken = metaCsrf.getAttribute('content');
                    }
                }

                fetch('/api/customer/logout', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'CSRF-Token': csrfToken
                    }
                })
                    .then(response => {
                        console.log('Logout response:', response);
                        return response.json();
                    })
                    .then(data => {
                        console.log('Logout data:', data);
                        if (data.success) {
                            window.location.href = '/';
                        } else {
                            console.error('Logout failed:', data.error);
                        }
                    })
                    .catch(error => console.error('Logout error:', error));
            });
        }


        // --- Add to Cart / Add to Wishlist (work on home, shop, and any page with these buttons) ---
        function getCsrfToken() {
            var csrfInput = document.querySelector('input[name="_csrf"]');
            if (csrfInput) return csrfInput.value;
            var metaCsrf = document.querySelector('meta[name="csrf-token"]');
            if (metaCsrf) return metaCsrf.getAttribute('content') || '';
            return '';
        }

        function imageUrlKey(url) {
            try {
                var abs = new URL(url, window.location.href);
                var p = abs.pathname;
                var seg = p.split('/').filter(Boolean).pop() || '';
                return { path: (abs.pathname + abs.search).toLowerCase(), file: seg.toLowerCase() };
            } catch (err) {
                var s = (url || '').split('?')[0];
                var seg2 = s.split('/').filter(Boolean).pop() || '';
                return { path: s.toLowerCase(), file: seg2.toLowerCase() };
            }
        }

        function imageUrlsLikelySame(a, b) {
            if (!a || !b) return false;
            var A = imageUrlKey(a);
            var B = imageUrlKey(b);
            if (A.path && A.path === B.path) return true;
            if (A.file && B.file && A.file === B.file && A.file.length > 3) return true;
            return false;
        }

        function readPresetFromSwatchEl($sw) {
            var presetValue =
                $sw.attr('data-option-value') || $sw.attr('title') || $sw.attr('aria-label') || '';
            if (presetValue) presetValue = String(presetValue).trim();
            var vid = $sw.attr('data-attribute-value-id');
            var vs = vid != null && String(vid).trim() !== '' ? String(vid).trim() : '';
            // 0 was used as placeholder and breaks modal matching (every swatch looked like id 0)
            var presetValueId = vs && vs !== '0' ? vs : null;
            return { presetValue: presetValue || null, presetValueId: presetValueId };
        }

        function getPresetFromListingCard($card) {
            if (!$card || !$card.length) {
                return { presetValue: null, presetValueId: null };
            }
            
            // Prioritize explicitly selected swatch first
            var $sel = $card.find('.product-color-swatch.selected').first();
            if ($sel.length) {
                var fromSel = readPresetFromSwatchEl($sel);
                if (fromSel.presetValue || fromSel.presetValueId) return fromSel;
            }

            // Fallback to visible image matching
            var $img = $card.find('.product-img .product-card-img').first();
            var visibleSrc = $img.length ? ($img.attr('src') || '') : '';
            if (visibleSrc) {
                var matched = null;
                $card.find('.product-color-swatch').each(function () {
                    var $sw = $(this);
                    var swUrl = $sw.attr('data-image-url') || '';
                    var $inner = $sw.find('.product-color-swatch-img');
                    if (!swUrl && $inner.length) swUrl = $inner.attr('src') || '';
                    if (!swUrl) return;
                    if (imageUrlsLikelySame(visibleSrc, swUrl)) {
                        matched = readPresetFromSwatchEl($sw);
                        return false;
                    }
                });
                if (matched && (matched.presetValue || matched.presetValueId)) return matched;
            }

            return { presetValue: null, presetValueId: null };
        }

        $(document).on('click', '.add-to-cart-btn', function (e) {
            if (e.isDefaultPrevented()) return;
            e.preventDefault();
            var $btn = $(this);
            var productId = $btn.attr('data-product-id');
            var hasVariants = $btn.attr('data-has-variants') === 'true';
            var slug = $btn.attr('data-slug');

            if (!productId) return;

            if (hasVariants && typeof window.openVariantModal === 'function') {
                var $card = $btn.closest('.product-item, .product-item-home');
                var presetOpts = null;
                if ($card.length) {
                    var pr = getPresetFromListingCard($card);
                    if (pr.presetValue || pr.presetValueId) {
                        presetOpts = { presetValue: pr.presetValue, presetValueId: pr.presetValueId };
                    }
                }
                window.openVariantModal(parseInt(productId, 10), presetOpts || undefined);
                return;
            }

            if (hasVariants && slug) {
                window.location.href = '/shop/product/' + slug;
                return;
            }

            $btn.prop('disabled', true).addClass('disabled');

            fetch('/api/cart/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': getCsrfToken()
                },
                body: JSON.stringify({ product_id: parseInt(productId, 10), quantity: 1 })
            })
                .then(function (response) {
                    if (!response.ok) {
                        return response.json().then(function (data) {
                            throw new Error(data.error || 'Failed to add product to cart');
                        });
                    }
                    return response.json();
                })
                .then(function (data) {
                    if (data.success) {
                        if (typeof window.updateCartBadge === 'function' && data.cartCount !== undefined) {
                            window.updateCartBadge(data.cartCount);
                        }
                        if (typeof showConfirmationModal === 'function') {
                            showConfirmationModal('Product added to cart!', function () {
                                window.location.href = '/cart';
                            }, {
                                title: 'Success',
                                confirmText: 'View Cart',
                                showCancel: true,
                                cancelText: 'Continue Shopping',
                                confirmClass: 'btn-primary'
                            });
                        } else {
                            alert('Product added to cart!');
                        }
                    } else {
                        if (typeof showAlert === 'function') {
                            showAlert('Error: ' + (data.error || data.message || 'Failed to add product to cart'), 'Error');
                        } else {
                            alert('Error: ' + (data.error || data.message || 'Failed to add product to cart'));
                        }
                    }
                })
                .catch(function (err) {
                    console.error('Add to cart error:', err);
                    if (typeof showAlert === 'function') {
                        showAlert('Error: ' + err.message, 'Error');
                    } else {
                        alert('Error: ' + err.message);
                    }
                })
                .finally(function () {
                    $btn.prop('disabled', false).removeClass('disabled');
                });
        });

        $(document).on('click', '.add-to-wishlist-btn', function (e) {
            e.preventDefault();
            var $btn = $(this);
            var productId = $btn.attr('data-product-id');
            if (!productId) return;

            $btn.prop('disabled', true).addClass('disabled');

            fetch('/api/customer/wishlist/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'CSRF-Token': getCsrfToken()
                },
                body: JSON.stringify({ product_id: parseInt(productId, 10) })
            })
                .then(function (response) {
                    if (!response.ok) {
                        return response.json().then(function (data) {
                            throw new Error(data.error || 'Failed to add product to wishlist');
                        });
                    }
                    return response.json();
                })
                .then(function (data) {
                    if (data.success) {
                        if (typeof showConfirmationModal === 'function') {
                            showConfirmationModal('Product added to wishlist!', function () {
                                window.location.href = '/wishlist';
                            }, {
                                title: 'Success',
                                confirmText: 'Go to Wishlist',
                                showCancel: true,
                                cancelText: 'Continue Shopping',
                                confirmClass: 'btn-success'
                            });
                        } else {
                            alert('Product added to wishlist!');
                        }
                    } else {
                        if (typeof showAlert === 'function') {
                            showAlert('Error: ' + (data.error || data.message || 'Failed to add product to wishlist'), 'Error');
                        } else {
                            alert('Error: ' + (data.error || data.message || 'Failed to add product to wishlist'));
                        }
                    }
                })
                .catch(function (err) {
                    console.error('Add to wishlist error:', err);
                    if (typeof showAlert === 'function') {
                        showAlert('Error: ' + err.message, 'Error');
                    } else {
                        alert('Error: ' + err.message);
                    }
                })
                .finally(function () {
                    $btn.prop('disabled', false).removeClass('disabled');
                });
        });

        // Shop by Category: switch tab and show corresponding product list
        $(".shop-by-category-section .category-tab").on("click", function (e) {
            e.preventDefault();
            var index = $(this).data("category-index");
            $(".shop-by-category-section .category-tab").removeClass("active");
            $(this).addClass("active");
            $(".shop-by-category-section .category-carousel-wrap").addClass("d-none");
            $(".shop-by-category-section .category-carousel-wrap[data-category-index=\"" + index + "\"]").removeClass("d-none");
        });

        // Home: Shop The Look – arrow / thumbnail selection updates big image + link
        document.querySelectorAll('.home-shop-look-row[data-shop-look]').forEach(function (row) {
            var tiles = Array.prototype.slice.call(row.querySelectorAll('[data-shop-look-tile]'));
            var imageLink = row.querySelector('[data-shop-look-image]');
            var imageEl = imageLink ? imageLink.querySelector('img') : null;
            var counterEl = row.querySelector('.home-shop-look-current');
            var totalEl = row.querySelector('.home-shop-look-total');
            var prevBtn = row.querySelector('.home-shop-look-prev');
            var nextBtn = row.querySelector('.home-shop-look-next');

            if (!tiles.length || !imageLink || !imageEl) return;

            var total = tiles.length;
            var current = 0;
            var swapTimer = null;

            function pad(n) { return n < 10 ? '0' + n : String(n); }

            if (totalEl) totalEl.textContent = pad(total);

            function selectIndex(index) {
                if (index < 0) index = total - 1;
                if (index >= total) index = 0;
                if (index === current) return;
                current = index;

                tiles.forEach(function (t, i) {
                    if (i === current) t.classList.add('is-active');
                    else t.classList.remove('is-active');
                });

                var tile = tiles[current];
                var newImage = tile.getAttribute('data-image');
                var newHref = tile.getAttribute('data-href');
                var newAlt = tile.getAttribute('data-alt') || '';

                if (counterEl) counterEl.textContent = pad(current + 1);
                if (newHref) imageLink.setAttribute('href', newHref);
                if (newAlt) imageLink.setAttribute('aria-label', newAlt);

                if (newImage && imageEl.getAttribute('src') !== newImage) {
                    imageLink.classList.add('is-swapping');
                    if (swapTimer) clearTimeout(swapTimer);
                    swapTimer = setTimeout(function () {
                        imageEl.setAttribute('src', newImage);
                        if (newAlt) imageEl.setAttribute('alt', newAlt);
                        imageLink.classList.remove('is-swapping');
                    }, 200);
                }
            }

            tiles.forEach(function (tile, i) {
                tile.addEventListener('click', function (e) {
                    e.preventDefault();
                    selectIndex(i);
                });
            });

            if (prevBtn) {
                prevBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    selectIndex(current - 1);
                });
            }
            if (nextBtn) {
                nextBtn.addEventListener('click', function (e) {
                    e.preventDefault();
                    selectIndex(current + 1);
                });
            }
        });

    });

    // Utility functions for updating header badges
    window.updateCartBadge = function (count) {
        const badges = document.querySelectorAll('.cart-badge');
        badges.forEach(badge => {
            badge.textContent = count;
            if (count > 0) {
                badge.classList.remove('d-none');
            } else {
                badge.classList.add('d-none');
            }
        });
    };

    window.updateWishlistBadge = function (count) {
        const badges = document.querySelectorAll('.wishlist-badge');
        badges.forEach(badge => {
            badge.textContent = count;
            if (count > 0) {
                badge.classList.remove('d-none');
            } else {
                badge.classList.add('d-none');
            }
        });
    };

    /**
     * Price Slider Logic (Bootstrap Slider)
     */
    function formatMoneyAmount(value) {
        var num = parseFloat(value);
        if (!isFinite(num)) return '0';
        var s = num.toFixed(2);
        if (s.slice(-3) === '.00') return s.slice(0, -3);
        return s;
    }

    $(document).ready(function() {
        if (typeof $.fn.slider !== 'function') {
            return;
        }
        // Initialize Desktop Slider
        if ($('#price-slider-desktop').length) {
            const sliderDesktop = $('#price-slider-desktop').slider({
                tooltip: 'hide', // Hide default tooltip, we use custom display
                selection: 'before' // or 'after' or 'none', but usually 'before' for single, 'none' for range? bootstrap-slider auto handles range styling
            });

            // Update display on slide
            sliderDesktop.on('slide', function(slideEvt) {
                $('#price-min-display-desktop').text('$' + formatMoneyAmount(slideEvt.value[0]));
                $('#price-max-display-desktop').text('$' + formatMoneyAmount(slideEvt.value[1]));
            });

            // Submit on slideStop
            sliderDesktop.on('slideStop', function(slideEvt) {
                $('#min_price_desktop').val(slideEvt.value[0]);
                $('#max_price_desktop').val(slideEvt.value[1]);
                // Submit the form
                $('#price-slider-desktop').closest('form').submit();
            });
        }

        // Initialize Mobile Slider
        if ($('#price-slider-mobile').length) {
            const sliderMobile = $('#price-slider-mobile').slider({
                tooltip: 'hide'
            });

            sliderMobile.on('slide', function(slideEvt) {
                $('#price-min-display-mobile').text('$' + formatMoneyAmount(slideEvt.value[0]));
                $('#price-max-display-mobile').text('$' + formatMoneyAmount(slideEvt.value[1]));
            });

            sliderMobile.on('slideStop', function(slideEvt) {
                $('#min_price_mobile').val(slideEvt.value[0]);
                $('#max_price_mobile').val(slideEvt.value[1]);
                $('#price-slider-mobile').closest('form').submit();
            });
        }
        
    });

})(jQuery);
