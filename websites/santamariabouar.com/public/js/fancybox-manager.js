/**
 * FancyboxManager Class - Handles image gallery functionality
 * Manages Fancybox initialization and configuration for project galleries
 */
class FancyboxManager {
  constructor() {
    this.isInitialized = false;
    this.defaultOptions = {
      buttons: [
        "zoom",
        "slideShow",
        "fullScreen",
        "thumbs",
        "close"
      ],
      animationEffect: "fade",
      transitionEffect: "fade",
      thumbs: {
        autoStart: false
      }
    };
  }

  // Initialize Fancybox with default or custom options
  init(customOptions = {}) {
    if (this.isInitialized) return;

    // Check if Fancybox is available
    if (typeof $.fn.fancybox === 'undefined') {
      console.warn('Fancybox library not loaded');
      return;
    }

    const options = { ...this.defaultOptions, ...customOptions };
    
    // Initialize Fancybox on all elements with data-fancybox attribute
    $('[data-fancybox]').fancybox(options);
    
    this.isInitialized = true;
    console.log('Fancybox initialized for projects gallery');
  }

  // Reinitialize Fancybox (useful for dynamically loaded content)
  reinit(customOptions = {}) {
    this.destroy();
    this.init(customOptions);
  }

  // Destroy Fancybox instances
  destroy() {
    if ($.fn.fancybox && $.fn.fancybox.destroy) {
      $.fn.fancybox.destroy();
    }
    this.isInitialized = false;
  }

  // Open Fancybox programmatically
  open(items, options = {}) {
    if (!this.isInitialized) {
      this.init();
    }
    $.fancybox.open(items, { ...this.defaultOptions, ...options });
  }

  // Close Fancybox
  close() {
    $.fancybox.close();
  }
}

// Export for modular usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FancyboxManager;
}
