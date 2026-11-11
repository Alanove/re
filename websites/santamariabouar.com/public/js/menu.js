/**
 * Menu Class - Encapsulates all menu functionality
 * Handles burger menu, dropdowns, mobile filters, and dynamic styling
 */
class Menu {
  constructor() {
    this.isInitialized = false;
    this.intersectionObserver = null;
  }

  // Initialize all menu functionality
  init() {
    if (this.isInitialized) return;
    
    this.setupBurgerMenu();
    this.setupDropdownMenu();
    this.setupMobileFilter();
    this.setupMenuCloseHandlers();
    this.setupResizeHandlers();
    this.setupDynamicStyling();
    this.setupFooterScrollAnimation();
    
    this.isInitialized = true;
    console.log('Menu system initialized');
  }

  // Setup burger menu toggle functionality
  setupBurgerMenu() {
    $('#burgerMenu').on('click', () => {
      this.toggleMenu();
    });
  }

  // Toggle menu open/close state
  toggleMenu() {
    $('#burgerMenu').toggleClass('active');
    $('#fullscreenMenu').toggleClass('active');
    
    // Prevent body scroll when menu is open
    if ($('#fullscreenMenu').hasClass('active')) {
      $('body').css('overflow', 'hidden');
      
      // Pause slideshow for performance (optional)
      if (window.slideshowInstance) {
        window.slideshowInstance.pauseSlideshow();
      }
    } else {
      $('body').css('overflow', 'auto');
      
      // Resume slideshow when menu closes
      if (window.slideshowInstance) {
        window.slideshowInstance.resumeSlideshow();
      }
    }
  }

  // Close menu
  closeMenu() {
    $('#burgerMenu').removeClass('active');
    $('#fullscreenMenu').removeClass('active');
    $('body').css('overflow', 'auto');
    
    // Resume slideshow when menu closes
    if (window.slideshowInstance) {
      window.slideshowInstance.resumeSlideshow();
    }
  }

  // Setup dropdown menu functionality for mobile
  setupDropdownMenu() {
    $('#fullscreenMenu .dropdown-toggle').on('click', (e) => {
      this.handleDropdownToggle(e);
    });
  }

  // Handle dropdown toggle clicks
  handleDropdownToggle(e) {
    // Only handle on mobile devices
    if (window.innerWidth <= 767) {
      e.preventDefault();
      e.stopPropagation();
      
      const $dropdown = $(e.target).closest('.dropdown');
      const $dropdownMenu = $dropdown.find('.dropdown-menu');
      
      // Close other open dropdowns
      $('#fullscreenMenu .dropdown').not($dropdown).removeClass('expanded');
      $('#fullscreenMenu .dropdown-menu').not($dropdownMenu).removeClass('expanded');
      
      // Toggle current dropdown
      $dropdown.toggleClass('expanded');
      $dropdownMenu.toggleClass('expanded');
    }
  }

  // Setup mobile filter functionality
  setupMobileFilter() {
    $('.mobile-filter-toggle').on('click', () => {
      this.toggleMobileFilter();
    });
  }

  // Toggle mobile filter
  toggleMobileFilter() {
    const $toggle = $('.mobile-filter-toggle');
    const $content = $('.mobile-filter-content');
    
    $toggle.toggleClass('active');
    $content.toggleClass('active');
  }

  // Setup all menu close handlers
  setupMenuCloseHandlers() {
    // Close menu when clicking on menu items (but not dropdown toggles)
    $('#fullscreenMenu a:not(.dropdown-toggle)').on('click', () => {
      this.closeMenu();
    });

    // Close menu when clicking outside menu content
    $('#fullscreenMenu').on('click', (e) => {
      if (e.target === e.currentTarget) {
        this.closeMenu();
      }
    });

    // Close dropdowns when clicking outside on mobile
    $(document).on('click', (e) => {
      if (window.innerWidth <= 767) {
        if (!$(e.target).closest('#fullscreenMenu .dropdown').length) {
          this.closeAllDropdowns();
        }
      }
    });

    // Close mobile filter when clicking outside
    $(document).on('click', (e) => {
      if (!$(e.target).closest('.side-bar').length) {
        this.closeMobileFilter();
      }
    });
  }

  // Close all dropdown menus
  closeAllDropdowns() {
    $('#fullscreenMenu .dropdown').removeClass('expanded');
    $('#fullscreenMenu .dropdown-menu').removeClass('expanded');
  }

  // Close mobile filter
  closeMobileFilter() {
    $('.mobile-filter-toggle').removeClass('active');
    $('.mobile-filter-content').removeClass('active');
  }

  // Setup window resize handlers
  setupResizeHandlers() {
    $(window).on('resize', () => {
      this.handleResize();
    });
  }

  // Handle window resize events
  handleResize() {
    if (window.innerWidth > 767) {
      // Reset mobile dropdown states when switching to desktop
      this.closeAllDropdowns();
    }
  }

  // Setup dynamic styling for homepage
  setupDynamicStyling() {
    const bodyEl = document.body;
    
    // If page already has an inner page style class, do nothing (other pages)
    if (bodyEl.classList.contains('inner-page') ||
        bodyEl.classList.contains('projects') ||
        bodyEl.classList.contains('who-we-are')) {
      return;
    }
    
    const slideshowEl = document.getElementById('slideshow');
    if (!slideshowEl) return; // Not on homepage

    // Use IntersectionObserver to toggle the class when slideshow leaves view
    this.intersectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Slideshow visible -> revert to white (remove inner-page)
          bodyEl.classList.remove('inner-page');
        } else {
          // Slideshow out of view -> apply inner-page (blue styles)
          bodyEl.classList.add('inner-page');
        }
      });
    }, {
      threshold: 0.2,          // Consider it "visible" while at least 20% shows
      rootMargin: '-60px 0px 0px 0px' // Trigger a bit earlier as header overlaps
    });
    
    this.intersectionObserver.observe(slideshowEl);
  }

  // Setup footer scroll animation - DISABLED since footer is now static
  setupFooterScrollAnimation() {
    // Footer is now static positioned and doesn't need scroll-based animations
    console.log('Footer scroll animation disabled - footer is now static');
  }

  // Cleanup method
  destroy() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    
    // Footer scroll handler no longer needed since footer is static
    
    this.isInitialized = false;
  }
}

// Export for modular usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Menu;
}
