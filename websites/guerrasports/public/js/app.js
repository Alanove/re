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
   * Back to Top Button (#footerTopButton in footer, .back-to-top in layout)
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

    document.querySelectorAll('.back-to-top').forEach(function(btn) {
      function toggleLayoutBackToTop() {
        if (window.pageYOffset > 100) {
          btn.style.display = 'block';
        } else {
          btn.style.display = 'none';
        }
      }

      btn.style.display = 'none';

      window.addEventListener('scroll', debounce(toggleLayoutBackToTop, 100));

      btn.addEventListener('click', function(e) {
        e.preventDefault();
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      });

      toggleLayoutBackToTop();
    });
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

        function syncActiveSlideVideo() {
            pauseAllHeroVideos();
            if (!videosReady) return;
            var active = carousel.querySelector(".carousel-item.active .hero-carousel-video");
            if (active) loadHeroVideo(active);
        }

        function scheduleFirstSlideVideo() {
            var first = carousel.querySelector(".carousel-item.active .hero-carousel-video");
            if (!first) return;
            window.setTimeout(function () {
                loadHeroVideo(first);
            }, 0);
        }

        $carousel.on("slid.bs.carousel", function () {
            syncActiveSlideVideo();
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

        // Bootstrap 4 auto-inits via data-ride before this runs and ignores later config merges.
        // pause:'hover' + interval:false still installs hover/touch handlers that fight our timer.
        if (!$carousel.data("bs.carousel")) {
            $carousel.carousel({ interval: false, pause: false, wrap: true, keyboard: true, touch: true });
        }

        var cycleTimer = null;

        function clearCycle() {
            if (cycleTimer !== null) {
                clearTimeout(cycleTimer);
                cycleTimer = null;
            }
        }

        function scheduleNext() {
            clearCycle();

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

        // Product / Events carousels – Swiper (reliable touch/drag, no jump on swipe)
        var productCarouselOpts = {
            slidesPerView: 2.5,
            spaceBetween: 12,
            loop: false,
            speed: 1000,
            navigation: {
                nextEl: null,
                prevEl: null
            },
            breakpoints: {
                576: { slidesPerView: 2, spaceBetween: 30 },
                768: { slidesPerView: 2, spaceBetween: 30 },
                992: { slidesPerView: 3, spaceBetween: 30 },
                1200: { slidesPerView: 4, spaceBetween: 30 }
            }
        };
        document.querySelectorAll(".product-carousel:not(.sub-brands-carousel)").forEach(function (el) {
            var next = el.querySelector(".swiper-button-next");
            var prev = el.querySelector(".swiper-button-prev");
            if (next && prev && typeof Swiper !== "undefined") {
                new Swiper(el, Object.assign({}, productCarouselOpts, {
                    navigation: { nextEl: next, prevEl: prev }
                }));
            }
        });
        document.querySelectorAll(".category-products-carousel").forEach(function (el) {
            var next = el.querySelector(".swiper-button-next");
            var prev = el.querySelector(".swiper-button-prev");
            if (next && prev && typeof Swiper !== "undefined") {
                new Swiper(el, Object.assign({}, productCarouselOpts, {
                    navigation: { nextEl: next, prevEl: prev }
                }));
            }
        });

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
                        if (data.meta && typeof window.MetaPixel !== 'undefined') {
                            window.MetaPixel.trackAddToCart(data.meta);
                        }
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
            var $visibleWrap = $(".shop-by-category-section .category-carousel-wrap[data-category-index=\"" + index + "\"]").removeClass("d-none");
            var catCarousel = $visibleWrap.find(".category-products-carousel")[0];
            if (catCarousel && catCarousel.swiper) catCarousel.swiper.update();
        });

        // Sub Brands Carousel – Swiper, autoplay, no nav
        document.querySelectorAll(".sub-brands-carousel").forEach(function (el) {
            if (typeof Swiper !== "undefined") {
                new Swiper(el, {
                    slidesPerView: 2,
                    spaceBetween: 30,
                    loop: true,
                    speed: 1000,
                    autoplay: { delay: 3000, disableOnInteraction: false },
                    breakpoints: {
                        576: { slidesPerView: 3 },
                        768: { slidesPerView: 4 },
                        992: { slidesPerView: 5 },
                        1200: { slidesPerView: 6 }
                    }
                });
            }
        });

        // Page Gallery Carousel – Swiper
        document.querySelectorAll(".page-gallery-carousel").forEach(function (el) {
            var next = el.querySelector(".swiper-button-next");
            var prev = el.querySelector(".swiper-button-prev");
            if (next && prev && typeof Swiper !== "undefined") {
                new Swiper(el, {
                    slidesPerView: 1,
                    spaceBetween: 30,
                    loop: false,
                    speed: 1000,
                    navigation: { nextEl: next, prevEl: prev },
                    breakpoints: {
                        768: { slidesPerView: 2 },
                        992: { slidesPerView: 3 },
                        1200: { slidesPerView: 4 }
                    }
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
