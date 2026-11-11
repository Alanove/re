/**
 * Project Statistics Class - Handles project statistics display and animations
 * Manages scroll navigation, counter animations, and reveal effects
 */
class ProjectStats {
  constructor() {
    this.isInitialized = false;
    this.statsObserver = null;
    this.scrollToStats = null;
    this.scrollToMap = null;
    this.projectStatsSection = null;
    this.projectsMapSection = null;
  }

  // Initialize project statistics functionality
  init() {
    if (this.isInitialized) return;
    
    this.setupElements();
    this.setupScrollNavigation();
    this.setupIntersectionObserver();
    this.setupHoverEffects();
    this.setupSmoothScroll();
    
    this.isInitialized = true;
    console.log('Project Statistics initialized');
  }

  // Setup DOM element references
  setupElements() {
    this.scrollToStats = document.getElementById('scrollToStats');
    this.scrollToMap = document.getElementById('scrollToMap');
    this.projectStatsSection = document.getElementById('projectStats');
    this.projectsMapSection = document.getElementById('projectsMap');
  }

  // Setup scroll navigation between sections
  setupScrollNavigation() {
    // Scroll to statistics section
    if (this.scrollToStats && this.projectStatsSection) {
      this.scrollToStats.addEventListener('click', () => {
        this.projectStatsSection.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      });
    }

    // Scroll to map section
    if (this.scrollToMap && this.projectsMapSection) {
      this.scrollToMap.addEventListener('click', () => {
        this.projectsMapSection.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      });
    }
  }

  // Setup intersection observer for reveal animations
  setupIntersectionObserver() {
    const observerOptions = {
      threshold: 0.3,
      rootMargin: '0px 0px -50px 0px'
    };

    this.statsObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.animateStatsCards(entry.target);
        } else {
          // Reset animation when section goes out of view
          this.resetStatsCards(entry.target);
        }
      });
    }, observerOptions);

    // Observe the stats section
    if (this.projectStatsSection) {
      this.statsObserver.observe(this.projectStatsSection);
    }
  }

  // Animate statistics cards with counter
  animateStatsCards(section) {
    const statCards = section.querySelectorAll('.stat-card');
    
    // Reset any existing animations first
    statCards.forEach(card => {
      card.classList.remove('animate');
      const numberElement = card.querySelector('.stat-number');
      if (numberElement) {
        numberElement.textContent = '0';
      }
    });
    
    // Animate cards with delay
    statCards.forEach((card, index) => {
      setTimeout(() => {
        card.classList.add('animate');
        this.animateCounter(card);
      }, index * 200);
    });
  }

  // Reset statistics cards for re-animation
  resetStatsCards(section) {
    const statCards = section.querySelectorAll('.stat-card');
    
    statCards.forEach(card => {
      card.classList.remove('animate');
      const numberElement = card.querySelector('.stat-number');
      if (numberElement) {
        numberElement.textContent = '0';
      }
    });
  }

  // Counter animation function
  animateCounter(card) {
    const numberElement = card.querySelector('.stat-number');
    const target = parseInt(card.dataset.target);
    
    if (!numberElement || isNaN(target)) return;

    const duration = 2000; // 2 seconds
    const startTime = performance.now();
    const startValue = 0;

    const updateCounter = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Easing function for smooth animation
      const easeOutQuart = 1 - Math.pow(1 - progress, 4);
      const currentValue = Math.floor(startValue + (target - startValue) * easeOutQuart);
      
      numberElement.textContent = currentValue;
      
      if (progress < 1) {
        requestAnimationFrame(updateCounter);
      } else {
        numberElement.textContent = target;
      }
    };

    requestAnimationFrame(updateCounter);
  }

  // Setup hover effects for stat cards
  setupHoverEffects() {
    const statCards = document.querySelectorAll('.stat-card');
    statCards.forEach(card => {
      card.addEventListener('mouseenter', function() {
        this.style.transform = 'translateY(-10px)';
      });

      card.addEventListener('mouseleave', function() {
        this.style.transform = 'translateY(0)';
      });
    });
  }

  // Setup smooth scroll for all internal links
  setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
      anchor.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.querySelector(anchor.getAttribute('href'));
        if (target) {
          target.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      });
    });
  }

  // Cleanup method
  destroy() {
    if (this.statsObserver) {
      this.statsObserver.disconnect();
    }
    this.isInitialized = false;
  }
}
