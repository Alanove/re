/**
 * Parallax Class - Handles parallax scroll effects
 * Provides smooth background parallax effects with performance optimization
 */
class Parallax {
  constructor() {
    this.isActive = false;
    this.parallaxFactor = 0.25; // lower = slower movement
    this.lastScrollY = window.scrollY;
    this.ticking = false;
    this.rafId = null;
  }

  // Initialize parallax effects
  init(factor = 0.25) {
    if (this.isActive) return;

    this.parallaxFactor = factor;
    this.setupScrollListener();
    this.updateBodyParallax(); // Initial set
    this.isActive = true;
    console.log('Parallax effects initialized');
  }

  // Setup scroll event listener with performance optimization
  setupScrollListener() {
    window.addEventListener('scroll', () => {
      // Respect user's motion preferences
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      
      this.lastScrollY = window.scrollY;
      this.requestParallaxUpdate();
    }, { passive: true });
  }

  // Update parallax background position
  updateBodyParallax() {
    // Use translate of background position for subtle vertical shift
    const offset = Math.round(this.lastScrollY * this.parallaxFactor);
    // Avoid large numbers; clamp to reasonable range
    const clamped = Math.max(-2000, Math.min(2000, offset));
    document.body.style.backgroundPosition = `center ${-clamped}px`;
    this.ticking = false;
  }

  // Request animation frame for smooth parallax updates
  requestParallaxUpdate() {
    if (!this.ticking) {
      this.rafId = window.requestAnimationFrame(() => {
        this.updateBodyParallax();
      });
      this.ticking = true;
    }
  }

  // Update parallax factor
  setFactor(factor) {
    this.parallaxFactor = factor;
  }

  // Pause parallax effects
  pause() {
    this.isActive = false;
    if (this.rafId) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  // Resume parallax effects
  resume() {
    if (!this.isActive) {
      this.isActive = true;
      this.requestParallaxUpdate();
    }
  }

  // Destroy parallax effects
  destroy() {
    this.pause();
    document.body.style.backgroundPosition = '';
    this.lastScrollY = 0;
    this.ticking = false;
  }
}

// Export for modular usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Parallax;
}
