/**
 * Combined Script File - Generated automatically
 * Contains: Menu, WorldMap, FancyboxManager, Parallax classes
 * Generated: 2025-08-19T12:28:29.396Z
 * 
 * Individual modules can be found in /js/ directory for development
 */

// ============================================================================
// MENU MODULE
// ============================================================================

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

  // Setup footer scroll animation
  setupFooterScrollAnimation() {
    const footerEl = document.querySelector('.main-footer');
    if (!footerEl) return;

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          
          // Add scrolled class immediately when user starts scrolling
          if (currentScrollY > 10) {
            footerEl.classList.add('scrolled');
          } else {
            footerEl.classList.remove('scrolled');
          }
          
          ticking = false;
        });
        ticking = true;
      }
    };

    // Listen for scroll events
    window.addEventListener('scroll', handleScroll, { passive: true });
    
    // Store reference for cleanup
    this.footerScrollHandler = handleScroll;
  }

  // Cleanup method
  destroy() {
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    
    // Remove footer scroll handler
    if (this.footerScrollHandler) {
      window.removeEventListener('scroll', this.footerScrollHandler);
      this.footerScrollHandler = null;
    }
    
    this.isInitialized = false;
  }
}



// ============================================================================
// WORLDMAP MODULE
// ============================================================================

/**
 * WorldMap Class - Encapsulates all map functionality
 * Handles interactive world map with project locations
 */
class WorldMap {
  constructor() {
    this.mapObserver = null;
    this.countryMapping = {
      'Saudi Arabia': { 
        codes: ['SA', 'saudi-arabia', 'ksa'],
        center: { x: 1250, y: 340 }
      },
      'UAE': { 
        codes: ['AE', 'united-arab-emirates', 'uae'],
        center: { x: 1300, y: 340 }
      },
      'Lebanon': { 
        codes: ['LB', 'lebanon'],
        center: { x: 1180, y: 290 }
      },
      'Iraq': { 
        codes: ['IQ', 'iraq'],
        center: { x: 1240, y: 280 }
      },
      'Canada': { 
        codes: ['CA', 'canada'],
        center: { x: 540, y: 140 }
      },
      'Nigeria': { 
        codes: ['NG', 'nigeria'],
        center: { x: 1060, y: 420 }
      },
      'Tanzania': { 
        codes: ['TZ', 'tanzania'],
        center: { x: 1140, y: 510 }
      },
      'Congo': { 
        codes: ['CG', 'congo', 'CD', 'democratic-republic-congo'],
        center: { x: 1080, y: 470 }
      },
      'Cuba': { 
        codes: ['CU', 'cuba'],
        center: { x: 550, y: 360 }
      },
      'Benin': { 
        codes: ['BJ', 'benin'],
        center: { x: 1010, y: 430 }
      },
      'Côte d\'Ivoire': { 
        codes: ['CI', 'cote-divoire', 'ivory-coast'],
        center: { x: 980, y: 410 }
      },
      'Latin America': { 
        codes: ['LA', 'latin-america'],
        center: { x: 600, y: 600 } // Central/South America region (moved right 50px more)
      }
    };
  }

  // Slugify helper for country paths
  slugifyCountry(name) {
    if (!name) return '';
    return name
      .normalize('NFD') // split accents
      .replace(/\p{Diacritic}/gu,'') // remove diacritics
      .toLowerCase()
      .replace(/&/g,'-and-')
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/-{2,}/g,'-')
      .replace(/^-|-$/g,'');
  }

  // Initialize the projects world map
  init() {
    console.log('Initializing world map...');
    
    // Clean up previous observer
    if (this.mapObserver) {
      this.mapObserver.disconnect();
      this.mapObserver = null;
    }
    
    const mapContainer = document.getElementById('worldMapContainer');
    
    if (!mapContainer) {
      console.log('Map container not found - element with ID "worldMapContainer" does not exist on this page');
      return;
    }
    
    console.log('Map container found:', mapContainer);
    
    // Get countries with projects from data attribute
    let countriesWithProjects = [];
    let projectsByCountry = {};
    try {
      const countriesData = mapContainer.getAttribute('data-countries');
      console.log('Raw countries data from attribute:', countriesData);
      countriesWithProjects = countriesData ? JSON.parse(countriesData) : [];
      console.log('Parsed countries with projects:', countriesWithProjects);
    } catch (e) {
      console.error('Error parsing countries data:', e);
    }
    
    // Load the world SVG
    console.log('Fetching world SVG from /images/world.svg');
    fetch('/images/world.svg')
      .then(response => {
        console.log('SVG fetch response status:', response.status);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
      })
      .then(svgContent => {
        console.log('SVG content loaded, length:', svgContent.length);
        // Insert SVG content
        mapContainer.innerHTML = svgContent;
        
        // Get the SVG element and add class
        const svg = mapContainer.querySelector('svg');
        if (svg) {
          svg.classList.add('world-map-svg');
          console.log('SVG loaded successfully');
          
          // Create some basic pointers for testing
          const pointersToCreate = [];
          
          // Check which countries have projects and collect them
          // Handle both array and object formats for countriesWithProjects
          if (Array.isArray(countriesWithProjects)) {
            // If it's an array of country names
            countriesWithProjects.forEach(country => {
              const countryData = this.countryMapping[country];
              if (countryData && countryData.center) {
                pointersToCreate.push({
                  country: country,
                  center: countryData.center
                });
              } else {
                console.warn(`No mapping found for country: ${country}`);
              }
            });
          } else if (typeof countriesWithProjects === 'object') {
            // If it's an object with countries as keys
            for (const [country] of Object.entries(countriesWithProjects)) {
              const countryData = this.countryMapping[country];
              if (countryData && countryData.center) {
                pointersToCreate.push({
                  country: country,
                  center: countryData.center
                });
              } else {
                console.warn(`No mapping found for country: ${country}`);
              }
            }
          }
          
          console.log('Creating', pointersToCreate.length, 'pointers for countries:', pointersToCreate.map(p => p.country));
          
          // Create SVG pointers directly inside the SVG
          setTimeout(() => {
            this.createSVGPointersSequentially(pointersToCreate, svg);
          }, 200);
          
          console.log('Map initialization complete');
        } else {
          console.error('SVG element not found after loading');
        }
      })
      .catch(error => {
        console.error('Error loading world SVG:', error);
        mapContainer.innerHTML = '<div class="map-error">Error loading world map: ' + error.message + '</div>';
      });
  }

  // Create SVG pointers sequentially with animation delay
  createSVGPointersSequentially(pointersToCreate, svg) {
    console.log('createSVGPointersSequentially called with:', pointersToCreate.length, 'pointers');
    
    // Clear existing pointers
    const existingPointers = svg.querySelectorAll('.country-pointer');
    console.log('Removing', existingPointers.length, 'existing pointers');
    existingPointers.forEach(pointer => pointer.remove());
    
    if (pointersToCreate.length === 0) {
      console.warn('No pointers to create!');
      return;
    }
    
    pointersToCreate.forEach((pointerData, index) => {
      const baseDelay = 60; // faster pointer appearance
      setTimeout(() => {
        // Create SVG circle element for the pointer
        const pointer = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        pointer.setAttribute('class', 'country-pointer');
        pointer.setAttribute('cx', pointerData.center.x);
        pointer.setAttribute('cy', pointerData.center.y);
        const baseRadius = window.innerWidth <= 480 ? 22 : (window.innerWidth <= 768 ? 20 : 16); // Increased from 18/16/12
        pointer.setAttribute('r', String(baseRadius));
        pointer.setAttribute('fill', 'var(--brand-blue, #007acc)');
        pointer.setAttribute('stroke', 'white');
        pointer.setAttribute('stroke-width', '3');
        pointer.setAttribute('opacity', '0');
        pointer.setAttribute('data-country', pointerData.country);
        
        // Ensure the pointer is visible by setting a fallback color
        pointer.style.fill = '#007acc';
        pointer.style.stroke = 'white';
        pointer.style.strokeWidth = '3px';
        
        // Set CSS custom property for staggered animation
        pointer.style.setProperty('--pointer-index', index.toString());
        
        // Set CSS custom property for staggered animation
        pointer.style.setProperty('--pointer-index', index.toString());
        
        // Add opacity animation for entrance only
        const opacityAnimate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
        opacityAnimate.setAttribute('attributeName', 'opacity');
        opacityAnimate.setAttribute('values', '0;1');
        opacityAnimate.setAttribute('dur', '0.3s');
        opacityAnimate.setAttribute('fill', 'freeze');
        opacityAnimate.setAttribute('begin', `${index * 0.1}s`);
        pointer.appendChild(opacityAnimate);
        
        console.log(`Creating SVG pointer for: ${pointerData.country} at (${pointerData.center.x}, ${pointerData.center.y})`);
        
        // Add click event listener for navigation
        pointer.addEventListener('click', (e) => {
          const countryName = e.target.getAttribute('data-country');
          if (countryName) {
            const slug = this.slugifyCountry(countryName);
            window.location.href = `/projects/countries/${slug}`;
          }
        });
        
        // Add pointer to SVG
        svg.appendChild(pointer);
        console.log(`Pointer added to SVG for ${pointerData.country}. SVG now has ${svg.querySelectorAll('.country-pointer').length} pointers.`);
        
      }, index * 100); // 300ms delay between each pointer
    });
  }

  // Update map statistics
  updateStatistics(countriesCount) {
    const statsContainer = $('.projects-stats .stats-grid');
    if (statsContainer.length === 0) {
      return;
    }

    // You can add more statistics here
    const stats = [
      { number: countriesCount, label: 'Countries' },
      { number: '50+', label: 'Projects' },
      { number: '15+', label: 'Years Experience' },
      { number: '100%', label: 'Quality Assured' }
    ];

    statsContainer.empty();
    stats.forEach(stat => {
      const statItem = $(`
        <div class="stat-item">
          <div class="stat-number">${stat.number}</div>
          <div class="stat-label">${stat.label}</div>
        </div>
      `);
      statsContainer.append(statItem);
    });
  }
}



// ============================================================================
// FANCYBOX-MANAGER MODULE
// ============================================================================

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



// ============================================================================
// PARALLAX MODULE
// ============================================================================

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



// ============================================================================
// PROJECT-STATS MODULE
// ============================================================================

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
  this.scrollToClients = document.getElementById('scrollToClients');
    this.projectStatsSection = document.getElementById('projectStats');
    this.projectsMapSection = document.getElementById('projectsMap');
  this.clientsSection = document.getElementById('clientsSection');
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

    // Scroll to clients section
    if (this.scrollToClients && this.clientsSection) {
      this.scrollToClients.addEventListener('click', () => {
        this.clientsSection.scrollIntoView({
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



// Legacy function for backward compatibility
function slugifyCountry(name) {
  return worldMapInstance.slugifyCountry(name);
}

// Fix jQuery easing issues by setting default easing
if (typeof jQuery !== 'undefined') {
  jQuery.easing.def = 'swing';
}

// Create global instances
const menuInstance = new Menu();
const worldMapInstance = new WorldMap();
const fancyboxManager = new FancyboxManager();
const parallaxInstance = new Parallax();
const projectStatsInstance = new ProjectStats();
// Simple Clients reveal module
class ClientsReveal {
  constructor() {
    this.observer = null;
    this.section = null;
  }
  init() {
    this.section = document.getElementById('clientsSection');
    if (!this.section) return;
    const cards = this.section.querySelectorAll('.client-card');
    // If IntersectionObserver not supported just show
    if (!('IntersectionObserver' in window)) {
      cards.forEach(c => c.classList.add('visible'));
      return;
    }
    this.observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const cards = entry.target.querySelectorAll('.client-card');
        if (entry.isIntersecting) {
            // Reset positions before re-adding visible to restart transition
            cards.forEach(card => {
              card.classList.remove('visible');
              // force reflow to restart animation cleanly
              // eslint-disable-next-line @typescript-eslint/no-unused-expressions
              card.offsetHeight;
              card.classList.add('visible');
            });
        } else {
            // Remove visible so animation can replay next time
            cards.forEach(card => card.classList.remove('visible'));
        }
      });
    }, { threshold: 0.25, rootMargin: '0px 0px -10% 0px' });
    this.observer.observe(this.section);
  }
}
const clientsRevealInstance = new ClientsReveal();

$(document).ready(function() {

  // Initialize menu system
  menuInstance.init();

  // Initialize Fancybox for image galleries
  fancyboxManager.init();

  // Initialize parallax effects
  parallaxInstance.init();

  // Initialize project statistics
  projectStatsInstance.init();
  // Initialize clients reveal
  clientsRevealInstance.init();

  // Slideshow initialization moved to /js/slideshow.js for WebGL enhancement

  // Scroll arrow functionality (native smooth scrolling)
  const $scrollArrow = $('#scrollToNext');
  if ($scrollArrow.length && !$scrollArrow.data('bound')) {
    $scrollArrow.data('bound', true);
    $scrollArrow.on('click', function(e) {
      e.preventDefault();
      const target = document.querySelector('.projects-map');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  // Initialize Projects Map after page load
  worldMapInstance.init();
  
  $(window).on('load', function() {
    console.log('Window loaded, reinitializing map...');
    worldMapInstance.init();
  });

  // Recalculate map on resize with debouncing
  let resizeTimeout;
  $(window).on('resize', function() {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(function() {
      const mapContainer = document.getElementById('worldMapContainer');
      if (mapContainer && mapContainer.innerHTML.trim() !== '') {
        console.log('Recalculating map on resize...');
        worldMapInstance.init();
      }
    }, 250); // Debounce resize events
  });

  // Initialize Back to Top functionality
  initBackToTop();

});

// ============================================================================
// BACK TO TOP FUNCTIONALITY
// ============================================================================

/**
 * Initialize back to top button functionality
 */
function initBackToTop() {
  const backToTopButton = document.getElementById('backToTop');
  
  if (!backToTopButton) {
    console.log('Back to top button not found');
    return;
  }

  // Show/hide button based on scroll position
  function toggleBackToTopButton() {
    const scrollPosition = window.pageYOffset || document.documentElement.scrollTop;
    const showThreshold = 300; // Show button after scrolling 300px

    if (scrollPosition > showThreshold) {
      backToTopButton.classList.add('visible');
    } else {
      backToTopButton.classList.remove('visible');
    }
  }

  // Smooth scroll to top function
  function scrollToTop() {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  // Event listeners
  window.addEventListener('scroll', toggleBackToTopButton, { passive: true });
  backToTopButton.addEventListener('click', scrollToTop);

  // Initial check
  toggleBackToTopButton();
  
  console.log('Back to top functionality initialized');
}

// Removed custom smoothScrollTo; relying on native scrollIntoView smooth behavior