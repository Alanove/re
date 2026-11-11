class App {
    constructor() {
        // HTML Elements
        this.header = null;
        this.burgerMenu = null;
        this.invertedSections = null;
        this.nonInvertedSections = null;
        this.footerTopButton = null;
        this.heroQuotes = null;
        this.loader = null;
        
        // Hero quotes state
        this.quotesInterval = null;
        this.currentQuoteIndex = 0;
        
        // Stats animation state
        this.animatedStats = new Set();
        
        // Reveal animation state
        this.revealedSections = new Set();
        this.animatedElements = new Set();
        
        // WorldMap instance
        this.worldMap = null;
        
        // Section indicators state
        this.sectionIndicators = null;
        this.indicators = [];
        this.sections = [];
        
        // URL hash update throttling
        this.lastHashUpdate = 0;
        this.hashUpdateThrottle = 200; // 200ms throttle
        
        // Flag to prevent URL hash updates and scroll events when menu is open
        this.isMenuOpen = false;
        
        // Store scroll position to prevent page jump
        this.savedScrollY = 0;
        
        // Mobile menu submenu behavior configuration
        // Set to true to allow direct navigation to parent menu items (default)
        // Set to false to use old behavior (toggle submenu on click)
        this.allowDirectNavigationForSubmenu = true;
        
        // Project modal elements
        this.projectModalOverlay = null;
        this.projectModal = null;
        this.projectModalClose = null;
        this.projectModalLoading = null;
        this.projectModalDetails = null;
        this.projectModalImage = null;
        this.projectNavPrev = null;
        this.projectNavNext = null;
        this.projectNavCounter = null;
        
        // Project navigation state
        this.allProjects = [];
        this.currentProjectIndex = 0;
        
        this.init();
    }

    init() {
        this.initHtmlElements();
        this.setupLoader();
        this.setupScrollListener();
        this.setupBackToTop();
        this.setupHeroQuotes();
        this.setupHeroSlider();
        this.setupSectionIndicators();
        this.setupScrollArrow();
        this.setupBurgerMenu();
        this.setupProjectModal();
        this.setupMobileProjectsFilter();
        this.initWorldMap();
        this.delayedInit();
        this.handleInitialHashtag();
    }

    initHtmlElements() {
        this.header = document.querySelector('header');
        this.burgerMenu = document.querySelector('.burger-menu');
        this.fullscreenMenu = document.querySelector('.fullscreen-menu');
        this.fullscreenCloseBtn = document.querySelector('.fullscreen-burger-menu');
        this.invertedSections = document.querySelectorAll('.main>section.inverted');
        this.nonInvertedSections = document.querySelectorAll('.main>section:not(.inverted)');
        this.footerTopButton = document.querySelector('#footerTopButton');
        this.heroQuotes = document.querySelector('.hero-quotes');
        this.loader = document.querySelector('#pageLoader');
        this.sectionIndicators = document.querySelector('#sectionIndicators');
        
        // Project modal elements
        this.projectModalOverlay = document.querySelector('#projectModalOverlay');
        this.projectModal = document.querySelector('#projectModal');
        this.projectModalClose = document.querySelector('#projectModalClose');
        this.projectModalLoading = document.querySelector('#projectModalLoading');
        this.projectModalDetails = document.querySelector('#projectModalDetails');
        this.projectModalImage = document.querySelector('#projectModalImage');
        this.projectNavPrev = document.querySelector('#projectNavPrev');
        this.projectNavNext = document.querySelector('#projectNavNext');
        this.projectNavCounter = document.querySelector('#projectNavCounter');
    }

    setupLoader() {
        // Hide loader after page is fully loaded
        window.addEventListener('load', () => {
            this.hideLoader();
        });
        
        // Fallback: Hide loader after 3 seconds max
        setTimeout(() => {
            this.hideLoader();
        }, 5000);
    }

    hideLoader() {
        if (this.loader) {
            this.loader.classList.add('hidden');
            
            // Remove the loader from DOM after animation completes
            setTimeout(() => {
                if (this.loader && this.loader.classList.contains('hidden')) {
                    this.loader.remove();
                }
            }, 500); // Match the CSS transition duration
        }
    }

    setupScrollListener() {
        window.addEventListener('scroll', () => {
            // Don't process scroll events when menu is open to prevent page jumps
            if (this.isMenuOpen) {
                return;
            }
            
            // Check burger menu visibility based on scroll position
            this.checkBurgerMenuVisibility();

            // Check if burger menu is above an inverted section
            this.checkInvertedSections();

            // Check if burger menu is above hero section
            this.checkAboveHero();

            // Update visible elements
            this.updateVisibleElements();
            
            // Animate project stats
            this.animateProjectStats();
            
            // Update active section indicator
            this.updateActiveIndicator();
            
            // Update indicator colors based on position
            this.updateIndicatorColors();
        });
    }

    checkBurgerMenuVisibility() {
        const scrollY = window.scrollY;
        
        if (!this.header || !this.burgerMenu) return;

        // Add has-burger-menu class when scrolled more than 75px (original behavior)
        // The CSS fixes now ensure this works on all pages including contact and projects
        if (scrollY > 75) {
            this.header.classList.add('has-burger-menu');
        } else {
            this.header.classList.remove('has-burger-menu');
        }
    }

    checkInvertedSections() {
        if (!this.header || !this.burgerMenu || !this.invertedSections) return;
        
        // Get burger menu position
        const burgerMenuRect = this.burgerMenu.getBoundingClientRect();
        const burgerMenuCenter = burgerMenuRect.top + (burgerMenuRect.height / 2);
        
        let isAboveInverted = false;

        // Check all sections (both inverted and non-inverted) to see which one the burger menu is over
        const allSections = [...this.invertedSections, ...this.nonInvertedSections];
        
        allSections.forEach((section) => {
            const sectionRect = section.getBoundingClientRect();
            const sectionTop = sectionRect.top;
            const sectionBottom = sectionRect.bottom;

            // Check if the burger menu center is within this section's bounds
            if (burgerMenuCenter >= sectionTop && burgerMenuCenter <= sectionBottom) {
                // Check if this section has the inverted class
                if (section.classList.contains('inverted')) {
                    isAboveInverted = true;
                }
            }
        });

        // Add or remove inverted class to header based on whether burger menu is above an inverted section
        if (isAboveInverted) {
            this.header.classList.add('inverted');
        } else {
            this.header.classList.remove('inverted');
        }
    }

    checkAboveHero() {
        if (!this.header || !this.burgerMenu) return;
        
        // Get hero section
        const heroSection = document.querySelector('.hero-section');
        if (!heroSection) return;
        
        // Get burger menu position
        const burgerMenuRect = this.burgerMenu.getBoundingClientRect();
        const burgerMenuCenter = burgerMenuRect.top + (burgerMenuRect.height / 2);
        
        // Get hero section position
        const heroRect = heroSection.getBoundingClientRect();
        const heroTop = heroRect.top;
        const heroBottom = heroRect.bottom;
        
        // Check if burger menu is above the hero section
        const isAboveHero = burgerMenuCenter >= heroTop && burgerMenuCenter <= heroBottom;
        
        // Add or remove above-hero class
        if (isAboveHero) {
            this.header.classList.add('above-hero');
        } else {
            this.header.classList.remove('above-hero');
        }
    }

    updateVisibleElements() {
        // Use existing sections from class properties
        const allSections = [...this.invertedSections, ...this.nonInvertedSections];
        
        // Get viewport dimensions
        const viewportHeight = window.innerHeight;
        const scrollTop = window.scrollY;
        
        allSections.forEach((section, index) => {
            const sectionRect = section.getBoundingClientRect();
            const sectionTop = sectionRect.top + scrollTop;
            
            // Calculate if user has scrolled 100px into the section
            const scrolledIntoSection = scrollTop + viewportHeight - sectionTop;
            const isRevealed = scrolledIntoSection >= 100;
            
            // Only process if section is in view and not already revealed
            if (isRevealed && !section.classList.contains('revealed')) {
                this.animateSectionSequentially(section);
            }
        });
    }

    animateSectionSequentially(section) {
        // Mark section as revealed to prevent re-animation
        section.classList.add('revealed');
        this.revealedSections.add(section);
        
        // Animate all section images with slide-in effect
        const sectionImages = section.querySelectorAll('.section-image img, .slide-in-image');
        sectionImages.forEach(img => {
            if (!img.classList.contains('animate')) {
                img.classList.add('animate');
            }
        });
        
        // Get all animatable elements in the section
        // Special handling for MEP & ICT and Energy & Sustainability pages to only animate first-level li elements
        let allElements;
        const isMepIctPage = window.location.pathname === '/what-we-do-mep-ict' || 
                           section.querySelector('.mep-services-grid');
        const isEnergyPage = window.location.pathname === '/what-we-do-energy-sustainability' || 
                           section.querySelector('.energy-services-grid');
        
        if (isMepIctPage && section.querySelector('.mep-services-grid')) {
            // For MEP & ICT page, only select first-level li elements and headings to improve performance
            allElements = section.querySelectorAll(
                '.mep-services-grid > li, h1, h2, h3, h4, h5, h6, p:not(.mep-services-grid li p), .service-card, .stat-card, .client-logo, .project-card, .card, .text-content, .image-content, .content-block, .grid-item, .feature-item, .testimonial-item, .service-item, .client-item'
            );
        } else if (isEnergyPage && section.querySelector('.energy-services-grid')) {
            // For Energy & Sustainability page, only select first-level li elements and headings to improve performance
            allElements = section.querySelectorAll(
                '.energy-services-grid > li, h1, h2, h3, h4, h5, h6, p:not(.energy-services-grid li p), .service-card, .stat-card, .client-logo, .project-card, .card, .text-content, .image-content, .content-block, .grid-item, .feature-item, .testimonial-item, .service-item, .client-item'
            );
        } else {
            // Default behavior for other pages
            allElements = section.querySelectorAll(
                'li, h1, h2, h3, h4, h5, h6, p, .service-card, .stat-card, .client-logo, .project-card, .card, .text-content, .image-content, .content-block, .grid-item, .feature-item, .testimonial-item, .service-item, .client-item'
            );
        }
        
        if (allElements.length === 0) return;
        
        // Filter out already animated elements
        const newElements = Array.from(allElements).filter(element => 
            !this.animatedElements.has(element)
        );
        
        if (newElements.length === 0) return;
        
        // Reset all new elements to initial state
        newElements.forEach((element, index) => {
            // Store original transition for later restoration
            element.dataset.originalTransition = element.style.transition || '';
            
            element.style.opacity = '0';
            element.style.transform = 'translateY(30px)';
            element.style.transition = 'none';
            
            // Mark as animated to prevent re-animation
            this.animatedElements.add(element);
        });
        
        // Force a reflow to ensure initial styles are applied
        section.offsetHeight;
        
        // Animate elements one by one with faster sequential timing
        newElements.forEach((element, index) => {
            setTimeout(() => {
                // Set our custom transition properties - faster animation
                element.style.transition = 'opacity 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                
                // Animate to final state
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
                
                // After animation completes, restore original transition
                setTimeout(() => {
                    element.style.transition = element.dataset.originalTransition;
                }, 300); // Match our animation duration
                
            }, index * 30); // 30ms delay between each element for less segregated animation
        });
    }

    animateProjectStats() {
        // Get all stat cards with data-target attributes
        const statCards = document.querySelectorAll('.stat-card[data-target]');
        
        statCards.forEach((card) => {
            const target = parseInt(card.getAttribute('data-target'));
            const statNumberElement = card.querySelector('.stat-number');
            
            // Skip if no stat number element found or target is not a valid number
            if (!statNumberElement || isNaN(target)) return;
            
            // Get unique identifier for this stat (using the element's id or create one)
            const statId = statNumberElement.id || `stat-${Math.random().toString(36).substr(2, 9)}`;
            
            // Skip if this stat has already been animated
            if (this.animatedStats.has(statId)) return;
            
            // Check if the stat card is in view (using same logic as sections)
            const cardRect = card.getBoundingClientRect();
            const cardTop = cardRect.top + window.scrollY;
            const viewportHeight = window.innerHeight;
            const scrollTop = window.scrollY;
            const scrolledIntoCard = scrollTop + viewportHeight - cardTop;
            const isInView = scrolledIntoCard >= 100;
            
            // Only animate if in view
            if (isInView) {
                // Mark this stat as animated to prevent re-animation
                this.animatedStats.add(statId);
                
                // Start animation
                this.animateNumber(statNumberElement, 0, target, 2000); // 2 second animation
            }
        });
    }

    animateNumber(element, start, end, duration) {
        // Calculate animation parameters
        const startTime = performance.now();
        const range = end - start;
        
        // Check if there's a "+" icon to preserve
        const plusIcon = element.querySelector('.stat-plus');
        const hasPlusIcon = plusIcon !== null;
        
        const updateNumber = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Use easeOutCubic for smooth deceleration
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const currentValue = Math.floor(start + (range * easeProgress));
            
            // Update the element's text content, preserving the "+" icon if present
            if (hasPlusIcon) {
                // Remove all text nodes but keep the plus icon
                const textNodes = [];
                for (let node of element.childNodes) {
                    if (node.nodeType === Node.TEXT_NODE) {
                        textNodes.push(node);
                    }
                }
                textNodes.forEach(node => node.remove());
                // Add the number as a text node before the plus icon
                element.insertBefore(document.createTextNode(currentValue.toLocaleString()), plusIcon);
            } else {
                element.textContent = currentValue.toLocaleString();
            }
            
            // Continue animation if not complete
            if (progress < 1) {
                requestAnimationFrame(updateNumber);
            } else {
                // Ensure final value is exactly the target, preserving the "+" icon if present
                if (hasPlusIcon) {
                    // Remove all text nodes but keep the plus icon
                    const textNodes = [];
                    for (let node of element.childNodes) {
                        if (node.nodeType === Node.TEXT_NODE) {
                            textNodes.push(node);
                        }
                    }
                    textNodes.forEach(node => node.remove());
                    // Add the final number as a text node before the plus icon
                    element.insertBefore(document.createTextNode(end.toLocaleString()), plusIcon);
                } else {
                    element.textContent = end.toLocaleString();
                }
            }
        };
        
        // Start the animation
        requestAnimationFrame(updateNumber);
    }

    animateAboutImage() {
        // Find the about section image
        const aboutImage = document.querySelector('#about .slide-in-image');
        
        if (aboutImage && !aboutImage.classList.contains('animate')) {
            // Add the animate class to trigger the CSS animation
            aboutImage.classList.add('animate');
        }
    }

    setupBackToTop() {
        // Function to scroll to top smoothly
        const scrollToTop = () => {
            window.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        };

        // Add event listener to footer TOP button
        if (this.footerTopButton) {
            this.footerTopButton.addEventListener('click', scrollToTop);
        }
    }

    setupScrollArrow() {
        // Find all scroll-arrow buttons on the page
        const scrollArrows = document.querySelectorAll('.scroll-arrow');
        
        scrollArrows.forEach(arrow => {
            arrow.addEventListener('click', (e) => {
                e.preventDefault();
                this.scrollToNextSection(arrow);
            });
        });
    }

    setupBurgerMenu() {
        if (!this.burgerMenu || !this.fullscreenMenu) return;

        // Add click event listener to burger menu
        this.burgerMenu.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleFullscreenMenu();
        });

        // Add click event listener to fullscreen close button
        if (this.fullscreenCloseBtn) {
            this.fullscreenCloseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.closeFullscreenMenu();
            });
        }

        // Add escape key listener to close menu
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.fullscreenMenu.classList.contains('active')) {
                this.closeFullscreenMenu();
            }
        });

        // Add click listener to menu items to close menu when navigating
        // If allowDirectNavigationForSubmenu is true, also close when clicking submenu parent links
        // If false (old behavior), don't close when clicking submenu toggles
        this.fullscreenMenu.addEventListener('click', (e) => {
            if (e.target.tagName === 'A') {
                const isSubmenuToggle = e.target.hasAttribute('data-submenu');
                if (!isSubmenuToggle || this.allowDirectNavigationForSubmenu) {
                    this.closeFullscreenMenu();
                }
            }
        });

        // Setup submenu functionality
        this.setupSubmenuInteractions();
        
        // Auto-open submenu for current page
        this.autoOpenCurrentSubmenu();
    }

    toggleFullscreenMenu() {
        if (this.fullscreenMenu.classList.contains('active')) {
            this.closeFullscreenMenu();
        } else {
            this.openFullscreenMenu();
        }
    }

    openFullscreenMenu() {
        // Save current scroll position to prevent jump
        this.savedScrollY = window.scrollY;
        
        // Set flag to prevent URL hash updates and scroll events while menu is open
        this.isMenuOpen = true;
        
        // Prevent scrolling using overflow hidden (doesn't interfere with backdrop-filter)
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        
        // Lock scroll position by setting it immediately
        window.scrollTo(0, this.savedScrollY);
        
        // Add active class to burger menu (transforms to X)
        this.burgerMenu.classList.add('active');
        
        // Add active class to fullscreen menu
        this.fullscreenMenu.classList.add('active');
        
        // Prevent body scrolling (CSS handles the rest)
        document.body.classList.add('menu-open');
        
        // Prevent scroll events
        this.preventScroll = (e) => {
            e.preventDefault();
            window.scrollTo(0, this.savedScrollY);
        };
        window.addEventListener('scroll', this.preventScroll, { passive: false });
        document.addEventListener('wheel', this.preventScroll, { passive: false });
        document.addEventListener('touchmove', this.preventScroll, { passive: false });
        
        // Animate menu items with stagger
        this.animateMenuItems(true);
        
        // Auto-open submenu for current page after a short delay
        setTimeout(() => {
            this.autoOpenCurrentSubmenu();
        }, 600); // Wait for menu animation to complete
    }

    closeFullscreenMenu() {
        // Remove active class from burger menu (transforms back to burger)
        this.burgerMenu.classList.remove('active');
        
        // Remove active class from fullscreen menu
        this.fullscreenMenu.classList.remove('active');
        
        // Re-enable body scrolling
        document.body.classList.remove('menu-open');
        document.documentElement.style.overflow = '';
        document.body.style.overflow = '';
        
        // Remove scroll prevention event listeners
        if (this.preventScroll) {
            window.removeEventListener('scroll', this.preventScroll);
            document.removeEventListener('wheel', this.preventScroll);
            document.removeEventListener('touchmove', this.preventScroll);
            this.preventScroll = null;
        }
        
        // Restore scroll position
        window.scrollTo(0, this.savedScrollY);
        
        // Animate menu items out
        this.animateMenuItems(false);
        
        // Re-enable URL hash updates and scroll events after menu closes
        this.isMenuOpen = false;
    }

    animateMenuItems(isOpening) {
        // Only target first-level li elements for smoother animation
        const menuItems = this.fullscreenMenu.querySelectorAll('ul > li');
        
        menuItems.forEach((item, index) => {
            if (isOpening) {
                // Stagger the animation for opening with faster timing
                setTimeout(() => {
                    item.classList.add('animate-in');
                }, index * 50); // Faster delay for quicker visibility
            } else {
                // Remove animation class when closing
                item.classList.remove('animate-in');
            }
        });
    }

    setupSubmenuInteractions() {
        // Handle submenu clicks in fullscreen menu
        this.fullscreenMenu.addEventListener('click', (e) => {
            const menuItem = e.target.closest('li.has-submenu');
            const submenuLink = e.target.closest('a[data-submenu]');
            
            if (submenuLink && menuItem) {
                // Check configuration flag: if false, use old behavior (toggle submenu)
                // If true (default), allow direct navigation to the page
                if (!this.allowDirectNavigationForSubmenu) {
                    e.preventDefault();
                    this.toggleSubmenu(menuItem);
                }
                // If allowDirectNavigationForSubmenu is true, let the link navigate normally
            }
        });

        // Handle submenu clicks in horizontal menu (hover behavior)
        const horizontalMenu = document.querySelector('nav ul');
        if (horizontalMenu) {
            horizontalMenu.addEventListener('mouseenter', (e) => {
                const menuItem = e.target.closest('li.has-submenu');
                if (menuItem) {
                    this.showHorizontalSubmenu(menuItem);
                }
            });

            horizontalMenu.addEventListener('mouseleave', (e) => {
                const menuItem = e.target.closest('li.has-submenu');
                if (menuItem) {
                    this.hideHorizontalSubmenu(menuItem);
                }
            });
        }
    }

    toggleSubmenu(menuItem) {
        const submenu = menuItem.querySelector('.submenu');
        const isOpen = menuItem.classList.contains('submenu-open');

        // Always reset all items first to prevent layering
        const allMenuItems = this.fullscreenMenu.querySelectorAll('ul > li'); // Only first-level li elements
        allMenuItems.forEach(item => {
            item.classList.remove('wheel-effect', 'submenu-open');
        });

        if (!isOpen) {
            // Apply wheel animation to all other items
            allMenuItems.forEach(item => {
                if (item !== menuItem) {
                    item.classList.add('wheel-effect');
                }
            });

            // Open the submenu immediately
            menuItem.classList.add('submenu-open');
        }
    }

    autoOpenCurrentSubmenu() {
        // Find the currently active menu item
        const activeMenuItem = this.fullscreenMenu.querySelector('a.active');
        if (!activeMenuItem) return;
        
        // Check if the active item is in a submenu
        const submenuItem = activeMenuItem.closest('.submenu li');
        if (submenuItem) {
            // Find the parent menu item that contains this submenu
            const parentMenuItem = submenuItem.closest('li.has-submenu');
            if (parentMenuItem) {
                // Open the parent submenu without toggling
                this.openSubmenu(parentMenuItem);
                return;
            }
        }
        
        // Also check if the active item is a parent menu item with submenu
        const parentMenuItem = activeMenuItem.closest('li.has-submenu');
        if (parentMenuItem && parentMenuItem.querySelector('a.active')) {
            // This is a parent menu item that's active, open its submenu
            this.openSubmenu(parentMenuItem);
        }
    }

    openSubmenu(menuItem) {
        const submenu = menuItem.querySelector('.submenu');
        if (!submenu) return;

        // Reset all items first
        const allMenuItems = this.fullscreenMenu.querySelectorAll('ul > li'); // Only first-level li elements
        allMenuItems.forEach(item => {
            item.classList.remove('wheel-effect', 'submenu-open');
        });

        // Apply wheel animation to all other items
        allMenuItems.forEach(item => {
            if (item !== menuItem) {
                item.classList.add('wheel-effect');
            }
        });

        // Open the submenu immediately
        menuItem.classList.add('submenu-open');
    }

    showHorizontalSubmenu(menuItem) {
        const submenu = menuItem.querySelector('.submenu');
        
        if (submenu) {
            submenu.style.opacity = '1';
            submenu.style.visibility = 'visible';
            submenu.style.transform = 'translateX(-50%) translateY(0)';
        }
    }

    hideHorizontalSubmenu(menuItem) {
        const submenu = menuItem.querySelector('.submenu');
        
        if (submenu) {
            submenu.style.opacity = '0';
            submenu.style.visibility = 'hidden';
            submenu.style.transform = 'translateX(-50%) translateY(-20px)';
        }
    }

    scrollToNextSection(arrowElement) {
        // Get the section that contains this scroll arrow
        const currentSection = arrowElement.closest('section');
        
        if (!currentSection) return;
        
        // Find the next section (sibling section)
        let nextSection = currentSection.nextElementSibling;
        
        // If no next sibling, look for the next section in the document
        if (!nextSection || nextSection.tagName !== 'SECTION') {
            // Get all sections and find the next one after current
            const allSections = document.querySelectorAll('section');
            const currentIndex = Array.from(allSections).indexOf(currentSection);
            
            if (currentIndex !== -1 && currentIndex < allSections.length - 1) {
                nextSection = allSections[currentIndex + 1];
            }
        }
        
        // If we found a next section, scroll to it smoothly
        if (nextSection) {
            const sectionId = nextSection.id;
            
            // First scroll smoothly to the section
            nextSection.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
            
            // Update the hash after a short delay to avoid interfering with smooth scroll
            if (sectionId) {
                setTimeout(() => {
                    window.location.hash = '#' + sectionId;
                }, 100);
            }
        }
    }

    setupHeroSlider() {
        const section = document.querySelector('.hero-section.hero-section--slider');
        if (!section) return;
        const root = section.querySelector('.hero-slider');
        if (!root) return;

        const slides = root.querySelectorAll('.hero-slide');
        if (slides.length === 0) return;

        const dots = section.querySelectorAll('.hero-slider__dot');
        const prevBtn = section.querySelector('.hero-slider__prev');
        const nextBtn = section.querySelector('.hero-slider__next');
        let current = 0;
        let timer = null;
        let hoverPaused = false;
        let sectionInView = false;
        const intervalMs = 10000;
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const quoteItems = section.querySelectorAll('.hero-quotes .quote-item');

        const goTo = (index) => {
            current = (index + slides.length) % slides.length;
            slides.forEach((slide, i) => {
                const active = i === current;
                slide.classList.toggle('is-active', active);
                slide.setAttribute('aria-hidden', active ? 'false' : 'true');
            });
            dots.forEach((dot, i) => {
                dot.classList.toggle('is-active', i === current);
                dot.setAttribute('aria-selected', i === current ? 'true' : 'false');
            });
            if (quoteItems.length > 0) {
                this.showQuote(quoteItems, current);
            }
        };

        const stopAutoplay = () => {
            if (timer !== null) {
                clearTimeout(timer);
                timer = null;
            }
        };

        const startAutoplay = () => {
            if (!sectionInView) return;
            if (prefersReducedMotion || slides.length <= 1) return;
            if (document.visibilityState === 'hidden') return;
            if (hoverPaused) return;
            stopAutoplay();
            const tick = () => {
                goTo(current + 1);
                timer = window.setTimeout(tick, intervalMs);
            };
            timer = window.setTimeout(tick, intervalMs);
        };

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                goTo(current + 1);
                startAutoplay();
            });
        }
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                goTo(current - 1);
                startAutoplay();
            });
        }
        dots.forEach((dot, i) => {
            dot.addEventListener('click', () => {
                goTo(i);
                startAutoplay();
            });
        });

        const pauseAutoplayOnHover = (el) => {
            if (!el) return;
            el.addEventListener('mouseenter', () => {
                hoverPaused = true;
                stopAutoplay();
            });
            el.addEventListener('mouseleave', () => {
                hoverPaused = false;
                startAutoplay();
            });
        };
        pauseAutoplayOnHover(section.querySelector('.hero-slider__dots'));
        pauseAutoplayOnHover(prevBtn);
        pauseAutoplayOnHover(nextBtn);

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                stopAutoplay();
            } else {
                startAutoplay();
            }
        });

        section.addEventListener('keydown', (e) => {
            if (slides.length <= 1) return;
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                goTo(current + 1);
                startAutoplay();
            } else if (e.key === 'ArrowLeft') {
                e.preventDefault();
                goTo(current - 1);
                startAutoplay();
            }
        });

        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    sectionInView = entry.isIntersecting;
                    if (entry.isIntersecting) startAutoplay();
                    else stopAutoplay();
                });
            },
            { threshold: 0.2 }
        );
        io.observe(section);
    }

    setupHeroQuotes() {
        // Check if hero quotes element exists
        if (!this.heroQuotes) return;

        // Get all quote items
        const quoteItems = this.heroQuotes.querySelectorAll('.quote-item');
        
        // If no quote items found, return
        if (quoteItems.length === 0) return;

        // Show first quote initially
        this.showQuote(quoteItems, 0);

        // When a slider is present, quotes advance in sync with slides (see setupHeroSlider); no separate timer.
        const sliderHero = document.querySelector('.hero-section.hero-section--slider');
        if (sliderHero && quoteItems.length > 1) {
            if (this.quotesInterval) {
                clearInterval(this.quotesInterval);
                this.quotesInterval = null;
            }
            return;
        }

        // Start rotation if there are multiple quotes (video hero only)
        if (quoteItems.length > 1) {
            this.startQuotesRotation(quoteItems);
        }
    }

    setupSectionIndicators() {
        // Check if section indicators container exists
        if (!this.sectionIndicators) return;

        // Clear any existing indicators and create ul structure
        this.sectionIndicators.innerHTML = '';
        this.indicators = [];
        this.sections = [];
        
        // Create ul element
        const indicatorList = document.createElement('ul');
        this.sectionIndicators.appendChild(indicatorList);

        // Find all sections within .main that contain h2 elements
        const mainDiv = document.querySelector('.main');
        if (!mainDiv) return;

        const foundSections = [];

        // First, check for hero section (doesn't have h2 but should be included)
        const heroSection = mainDiv.querySelector('section.hero-section');
        if (heroSection) {
            foundSections.push(heroSection);
        }

        // Get parent sections of h2 elements (more compatible approach)
        const h2Elements = mainDiv.querySelectorAll('h2');
        h2Elements.forEach((h2, index) => {
            const section = h2.closest('section');
            if (section && !foundSections.includes(section)) {
                foundSections.push(section);
            }
        });

        // Create indicators for each section
        foundSections.forEach((section, index) => {
            const h2 = section.querySelector('h2');
            let sectionTitle = 'Section';

            // Determine section title
            if (h2) {
                sectionTitle = h2.textContent.trim();
            } else if (section.classList.contains('hero-section')) {
                sectionTitle = 'Top';
            } else {
                // Fallback: use section class or generic name
                sectionTitle = `Section ${index + 1}`;
            }

            // Create li element
            const listItem = document.createElement('li');
            
            // Create indicator span
            const indicatorSpan = document.createElement('span');
            indicatorSpan.className = 'indicator';

            // Create title span
            const titleSpan = document.createElement('span');
            titleSpan.className = 'title';
            titleSpan.textContent = sectionTitle;

            // Add spans to li
            listItem.appendChild(indicatorSpan);
            listItem.appendChild(titleSpan);

            // Add click event listener to li
            listItem.addEventListener('click', () => {
                this.scrollToSection(section);
            });

            // Add to containers
            indicatorList.appendChild(listItem);
            this.indicators.push(listItem); // Store li element for active state
            this.sections.push(section);
        });

        // Show indicators only if we found sections and screen is large enough
        if (foundSections.length > 0) {
            // Don't set inline display style - let CSS media queries handle visibility
            // Remove any existing inline display style to let CSS take control
            this.sectionIndicators.style.display = '';
        } else {
            this.sectionIndicators.style.display = 'none';
        }
    }


    scrollToSection(section) {
        if (!section) return;
        
        // Update URL with section hashtag
        const sectionId = section.id;
        if (sectionId) {
            // Update URL without triggering page reload
            history.pushState(null, null, `#${sectionId}`);
        }
        
        // Calculate the target position with better offset handling
        const targetPosition = section.offsetTop;
        
        // Use faster custom smooth scroll implementation
        this.smoothScrollTo(Math.max(0, targetPosition), 800, () => {
            // Update active indicator after scroll completes
            this.updateActiveIndicator();
        }); // 800ms duration
    }

    smoothScrollTo(targetY, duration = 800, callback = null) {
        const startY = window.scrollY;
        const distance = targetY - startY;
        const startTime = performance.now();

        const easeInOutCubic = (t) => {
            return t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
        };

        const animateScroll = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easedProgress = easeInOutCubic(progress);
            
            window.scrollTo(0, startY + distance * easedProgress);
            
            if (progress < 1) {
                requestAnimationFrame(animateScroll);
            } else if (callback) {
                // Call the callback when animation completes
                callback();
            }
        };

        requestAnimationFrame(animateScroll);
    }

    updateActiveIndicator() {
        if (!this.indicators.length || !this.sections.length) return;
        
        const scrollTop = window.scrollY;
        const viewportHeight = window.innerHeight;
        const headerHeight = this.header ? this.header.offsetHeight : 0;
        const additionalOffset = 70; // Same offset as scroll function
        
        let activeIndex = 0; // Default to first section
        
        // Find which section the user has scrolled to
        this.sections.forEach((section, index) => {
            const sectionTop = section.offsetTop - headerHeight - additionalOffset;
            
            // If we've scrolled past this section's adjusted top position
            if (scrollTop >= sectionTop - 50) { // 50px buffer for better detection
                activeIndex = index;
            }
        });
        
        // Special case: if we're near the bottom of the page, activate the last section
        if (scrollTop + viewportHeight >= document.documentElement.scrollHeight - 100) {
            activeIndex = this.sections.length - 1;
        }
        
        // Update active indicator
        this.indicators.forEach((listItem, index) => {
            if (index === activeIndex) {
                listItem.classList.add('active');
            } else {
                listItem.classList.remove('active');
            }
        });
        
        // Update URL hash based on active section (with throttling)
        this.updateUrlHash(activeIndex);
    }
    
    updateUrlHash(activeIndex) {
        // Don't update URL hash when menu is open
        if (this.isMenuOpen) {
            return;
        }
        
        // Throttle URL hash updates to prevent excessive history entries
        const now = Date.now();
        if (now - this.lastHashUpdate < this.hashUpdateThrottle) {
            return;
        }
        
        // Get the active section
        const activeSection = this.sections[activeIndex];
        if (!activeSection || !activeSection.id) {
            return;
        }
        
        const currentHash = window.location.hash.substring(1); // Remove #
        const newHash = activeSection.id;
        
        // Only update if the hash has actually changed
        if (currentHash !== newHash) {
            // Use replaceState to update URL without creating browser history entries
            // This prevents the back button from cycling through every section
            history.replaceState(null, null, `#${newHash}`);
            this.lastHashUpdate = now;
        }
    }

    updateIndicatorColors() {
        if (!this.indicators.length || !this.sectionIndicators) return;
        
        // Get indicators position (use the container position)
        const indicatorsRect = this.sectionIndicators.getBoundingClientRect();
        const indicatorsCenter = indicatorsRect.top + (indicatorsRect.height / 2);
        
        let isAboveInverted = false;
        let shouldHideIndicators = false;

        // Check for hero section
        const heroSection = document.querySelector('.hero-section');
        if (heroSection) {
            const heroRect = heroSection.getBoundingClientRect();
            if (indicatorsCenter >= heroRect.top && indicatorsCenter <= heroRect.bottom) {
                shouldHideIndicators = true;
            }
        }

        // Check for footer
        const footer = document.querySelector('footer, .main-footer');
        if (footer) {
            const footerRect = footer.getBoundingClientRect();
            if (indicatorsCenter >= footerRect.top && indicatorsCenter <= footerRect.bottom) {
                shouldHideIndicators = true;
            }
        }

        // Hide/show indicators based on position
        if (shouldHideIndicators) {
            this.sectionIndicators.style.opacity = '0';
            return; // Don't process color changes when hidden
        } else {
            this.sectionIndicators.style.opacity = '1';
        }

        // Check all sections (both inverted and non-inverted) to see which one the indicators are over
        const allSections = [...this.invertedSections, ...this.nonInvertedSections];
        
        allSections.forEach((section) => {
            const sectionRect = section.getBoundingClientRect();
            const sectionTop = sectionRect.top;
            const sectionBottom = sectionRect.bottom;

            // Check if the indicators center is within this section's bounds
            if (indicatorsCenter >= sectionTop && indicatorsCenter <= sectionBottom) {
                // Check if this section has the inverted class
                if (section.classList.contains('inverted')) {
                    isAboveInverted = true;
                }
            }
        });

        // Add or remove inverted class to all indicators based on section type
        this.indicators.forEach(listItem => {
            if (isAboveInverted) {
                listItem.classList.add('inverted');
            } else {
                listItem.classList.remove('inverted');
            }
        });
    }

    showQuote(quoteItems, index) {
        // Remove active class from all quotes
        quoteItems.forEach(item => item.classList.remove('active'));
        
        // Add active class to current quote
        if (quoteItems[index]) {
            quoteItems[index].classList.add('active');
        }
        
        // Update current index
        this.currentQuoteIndex = index;
    }

    startQuotesRotation(quoteItems) {
        // Clear any existing interval
        if (this.quotesInterval) {
            clearInterval(this.quotesInterval);
        }

        // Start new interval (change quote every 5 seconds)
        this.quotesInterval = setInterval(() => {
            // Calculate next quote index
            const nextIndex = (this.currentQuoteIndex + 1) % quoteItems.length;
            
            // Show next quote
            this.showQuote(quoteItems, nextIndex);
        }, 5000);
    }

    initWorldMap() {
        // Check if we're on the home page by looking for the world map container
        const worldMapContainer = document.getElementById('worldMapContainer');
        
        if (worldMapContainer) {
            // Only initialize WorldMap if we're on the home page
            if (typeof WorldMap !== 'undefined') {
                this.worldMap = new WorldMap();
                this.worldMap.init();
            } else {
                console.warn('WorldMap class not available. Make sure worldmap.js is loaded.');
            }
        }
        
        // Check if we're on the contact page by looking for the contact map container
        const contactMapContainer = document.getElementById('contactMapContainer');
        
        if (contactMapContainer) {
            // Initialize contact map
            if (typeof WorldMap !== 'undefined') {
                if (!this.worldMap) {
                    this.worldMap = new WorldMap();
                }
                this.worldMap.initContactMap();
            } else {
                console.warn('WorldMap class not available. Make sure worldmap.js is loaded.');
            }
        }
    }

    delayedInit() {
        // Delay execution to ensure all elements are properly rendered
        setTimeout(() => {
            // Call functions once to set initial header state
            this.checkBurgerMenuVisibility();
            this.checkInvertedSections();
            this.checkAboveHero();
            
            // Set initial visibility state for sections
            this.updateVisibleElements();
            
            // Check for stats to animate on initial load
            this.animateProjectStats();
            
            // Set initial active indicator
            this.updateActiveIndicator();
            
            // Set initial indicator colors
            this.updateIndicatorColors();
        }, 100);
    }

    handleInitialHashtag() {
        // Check if there's a hashtag in the URL
        const hash = window.location.hash;
        if (hash && hash.length > 1) {
            // Remove the # from the hash
            const sectionId = hash.substring(1);
            const section = document.getElementById(sectionId);
            
            if (section) {
                // Delay the scroll to allow page to fully load
                setTimeout(() => {
                    this.scrollToSection(section);
                }, 500);
            }
        }
    }

    setupProjectModal() {
        if (!this.projectModalOverlay) return;

        // Collect all projects data from the page
        const projectLinks = document.querySelectorAll('.project-link[data-project]');
        this.allProjects = [];
        
        projectLinks.forEach((link, index) => {
            const projectData = link.getAttribute('data-project');
            if (projectData) {
                try {
                    const project = JSON.parse(projectData);
                    this.allProjects.push(project);
                    
                    // Add click event listener
                    link.addEventListener('click', (e) => {
                        e.preventDefault();
                        this.currentProjectIndex = index;
                        this.openProjectModal(project);
                    });
                } catch (error) {
                    console.error('Error parsing project data:', error);
                }
            }
        });

        // Setup navigation buttons
        if (this.projectNavPrev) {
            this.projectNavPrev.addEventListener('click', () => {
                this.navigateToProject('prev');
            });
            this.checkBootstrapIcons(this.projectNavPrev);
        }
        
        if (this.projectNavNext) {
            this.projectNavNext.addEventListener('click', () => {
                this.navigateToProject('next');
            });
            this.checkBootstrapIcons(this.projectNavNext);
        }

        // Setup close button
        if (this.projectModalClose) {
            this.projectModalClose.addEventListener('click', () => {
                this.closeProjectModal();
            });
        }

        // Setup overlay click to close
        this.projectModalOverlay.addEventListener('click', (e) => {
            if (e.target === this.projectModalOverlay) {
                this.closeProjectModal();
            }
        });

        // Setup keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (this.projectModalOverlay.classList.contains('active')) {
                switch (e.key) {
                    case 'Escape':
                        this.closeProjectModal();
                        break;
                    case 'ArrowLeft':
                        e.preventDefault();
                        this.navigateToProject('prev');
                        break;
                    case 'ArrowRight':
                        e.preventDefault();
                        this.navigateToProject('next');
                        break;
                }
            }
        });

        // Setup touch/swipe navigation
        this.setupTouchNavigation();
    }

    setupTouchNavigation() {
        if (!this.projectModal) return;

        let startX = 0;
        let startY = 0;
        let endX = 0;
        let endY = 0;
        const minSwipeDistance = 50; // Minimum distance for a swipe
        const maxVerticalDistance = 100; // Maximum vertical movement to still count as horizontal swipe

        this.projectModal.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                startX = e.touches[0].clientX;
                startY = e.touches[0].clientY;
            }
        }, { passive: true });

        this.projectModal.addEventListener('touchend', (e) => {
            if (e.changedTouches.length === 1) {
                endX = e.changedTouches[0].clientX;
                endY = e.changedTouches[0].clientY;
                
                const deltaX = endX - startX;
                const deltaY = Math.abs(endY - startY);
                
                // Only trigger swipe if:
                // 1. Horizontal movement is significant enough
                // 2. Vertical movement is not too much (to avoid conflicts with scrolling)
                if (Math.abs(deltaX) > minSwipeDistance && deltaY < maxVerticalDistance) {
                    if (deltaX > 0) {
                        // Swipe right - go to previous project
                        this.navigateToProject('prev');
                    } else {
                        // Swipe left - go to next project
                        this.navigateToProject('next');
                    }
                }
            }
        }, { passive: true });
    }

    setupMobileProjectsFilter() {
        // Find the mobile filter toggle button
        const mobileFilterToggle = document.querySelector('.mobile-filter-toggle');
        const mobileFilterContent = document.querySelector('.mobile-filter-content');
        
        if (!mobileFilterToggle || !mobileFilterContent) return;
        
        // Add click event listener to toggle the dropdown
        mobileFilterToggle.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleMobileProjectsFilter();
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!mobileFilterToggle.contains(e.target) && !mobileFilterContent.contains(e.target)) {
                this.closeMobileProjectsFilter();
            }
        });
        
        // Close dropdown on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && mobileFilterContent.classList.contains('active')) {
                this.closeMobileProjectsFilter();
            }
        });
    }

    toggleMobileProjectsFilter() {
        const mobileFilterToggle = document.querySelector('.mobile-filter-toggle');
        const mobileFilterContent = document.querySelector('.mobile-filter-content');
        
        if (!mobileFilterToggle || !mobileFilterContent) return;
        
        const isActive = mobileFilterContent.classList.contains('active');
        
        if (isActive) {
            this.closeMobileProjectsFilter();
        } else {
            this.openMobileProjectsFilter();
        }
    }

    openMobileProjectsFilter() {
        const mobileFilterToggle = document.querySelector('.mobile-filter-toggle');
        const mobileFilterContent = document.querySelector('.mobile-filter-content');
        
        if (!mobileFilterToggle || !mobileFilterContent) return;
        
        mobileFilterToggle.classList.add('active');
        mobileFilterContent.style.display = 'block';
        
        // Small delay to allow display change to take effect before animation
        setTimeout(() => {
            mobileFilterContent.classList.add('active');
        }, 10);
    }

    closeMobileProjectsFilter() {
        const mobileFilterToggle = document.querySelector('.mobile-filter-toggle');
        const mobileFilterContent = document.querySelector('.mobile-filter-content');
        
        if (!mobileFilterToggle || !mobileFilterContent) return;
        
        mobileFilterToggle.classList.remove('active');
        mobileFilterContent.classList.remove('active');
        
        // Hide the element after animation completes
        setTimeout(() => {
            if (!mobileFilterContent.classList.contains('active')) {
                mobileFilterContent.style.display = 'none';
            }
        }, 200); // Match the CSS transition duration
    }

    navigateToProject(direction) {
        if (this.allProjects.length === 0) return;
        
        if (direction === 'next') {
            this.currentProjectIndex = (this.currentProjectIndex + 1) % this.allProjects.length;
        } else if (direction === 'prev') {
            this.currentProjectIndex = (this.currentProjectIndex - 1 + this.allProjects.length) % this.allProjects.length;
        }
        
        const project = this.allProjects[this.currentProjectIndex];
        this.renderProjectModalWithTransition(project);
        this.updateNavigationState();
    }

    renderProjectModalWithTransition(project) {
        // Add loading class to image for transition
        if (this.projectModalImage) {
            this.projectModalImage.classList.add('loading');
        }
        
        // Add loading class to details for transition
        if (this.projectModalDetails) {
            this.projectModalDetails.style.opacity = '0.3';
            this.projectModalDetails.style.transform = 'translateY(10px)';
        }
        
        // Update content after a short delay to allow transition to start
        setTimeout(() => {
            this.renderProjectModal(project);
            
            // Remove loading class after content is updated
            setTimeout(() => {
                if (this.projectModalImage) {
                    this.projectModalImage.classList.remove('loading');
                }
                if (this.projectModalDetails) {
                    this.projectModalDetails.style.opacity = '1';
                    this.projectModalDetails.style.transform = 'translateY(0)';
                }
            }, 50);
        }, 150);
    }

    checkBootstrapIcons(button) {
        // Check if Bootstrap Icons are loaded by testing if the icon has content
        const icon = button.querySelector('i.bi');
        if (icon) {
            // Give Bootstrap Icons time to load
            setTimeout(() => {
                const computedStyle = window.getComputedStyle(icon, '::before');
                const content = computedStyle.getPropertyValue('content');
                
                // If Bootstrap Icons are loaded, the ::before pseudo-element will have content
                if (content && content !== 'none' && content !== '""') {
                    button.classList.add('has-icon');
                } else {
                    button.classList.remove('has-icon');
                }
            }, 100);
        }
    }

    updateNavigationState() {
        if (!this.projectNavCounter) return;
        
        const current = this.currentProjectIndex + 1;
        const total = this.allProjects.length;
        this.projectNavCounter.textContent = `${current} / ${total}`;
    }

    openProjectModal(project) {
        if (!this.projectModalOverlay) return;

        // Show modal
        this.projectModalOverlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Hide loading, show content immediately since data is available
        this.projectModalLoading.style.display = 'none';
        this.projectModalDetails.style.display = 'block';

        // Render project data and update navigation
        this.renderProjectModal(project);
        this.updateNavigationState();
        
        // Check Bootstrap Icons after modal is shown
        if (this.projectNavPrev) this.checkBootstrapIcons(this.projectNavPrev);
        if (this.projectNavNext) this.checkBootstrapIcons(this.projectNavNext);
    }

    renderProjectModal(project) {
        // Hide loading state
        this.projectModalLoading.style.display = 'none';
        this.projectModalDetails.style.display = 'block';

        // Set main image
        if (this.projectModalImage && project.image) {
            this.projectModalImage.src = project.image;
            this.projectModalImage.alt = project.title;
        }

        // Build project details HTML
        const detailsHTML = this.buildProjectDetailsHTML(project);
        this.projectModalDetails.innerHTML = detailsHTML;

        // Setup image gallery if fancybox is available
        if (window.Fancybox) {
            window.Fancybox.bind('[data-fancybox]');
        }
    }

    buildProjectDetailsHTML(project) {
        let html = `
            <h1 class="project-modal-title">${project.title}</h1>
        `;

        // Categories
        if (project.categories && project.categories.length > 0) {
            html += `
                <div class="project-modal-categories">
                    ${project.categories.map(cat => `<span class="category-tag">${cat}</span>`).join('')}
                </div>
            `;
        }

        // Project details grid
        html += '<div class="project-modal-details"><div class="project-details-grid">';
        
        const detailFields = [
            { key: 'country', label: 'Country' },
            { key: 'bau', label: 'BAU' },
            { key: 'area', label: 'Area' },
            { key: 'size', label: 'Size' },
            { key: 'quantity', label: 'Quantity' },
            { key: 'contractor', label: 'Contractor' },
            { key: 'architect', label: 'Architect' },
            { key: 'client', label: 'Client' },
            { key: 'land', label: 'Land' },
            { key: 'capacity', label: 'Capacity' },
            { key: 'districts', label: 'Districts' },
            { key: 'owner', label: 'Owner' },
            { key: 'consultant', label: 'Consultant' }
        ];

        detailFields.forEach(field => {
            if (project[field.key]) {
                html += `
                    <div class="detail-item">
                        <strong>${field.label}:</strong>
                        <span>${project[field.key]}</span>
                    </div>
                `;
            }
        });

        html += '</div>'; // Close project-details-grid

        // All text section
        if (project.all_text) {
            html += `
                <div class="project-all-text-section">
                    <h4>Additional Information</h4>
                    <p>${project.all_text}</p>
                </div>
            `;
        }

        // Scope of work
        if (project.scope) {
            html += `
                <div class="project-scope-section">
                    <h4>Scope of Work</h4>
                    <p>${project.scope}</p>
                </div>
            `;
        }

        // Works sections
        if (project.works && project.works.length > 0) {
            html += '<hr class="project-separator">';
            
            project.works.forEach((work, index) => {
                html += '<div class="project-work-item">';
                
                // Work details
                if (work.details) {
                    html += '<div class="work-details">';
                    Object.entries(work.details).forEach(([key, value]) => {
                        html += `
                            <div class="work-detail-line">
                                <strong>${key.charAt(0).toUpperCase() + key.slice(1)}:</strong> ${value}
                            </div>
                        `;
                    });
                    html += '</div>';
                }

                // Scope of work
                if (work.scope_of_work && work.scope_of_work.length > 0) {
                    html += `
                        <h4>Scope of Work</h4>
                        <ul>
                            ${work.scope_of_work.map(item => `<li>${item}</li>`).join('')}
                        </ul>
                    `;
                }

                // Work images
                if (work.images && work.images.length > 0) {
                    html += '<div class="work-images">';
                    work.images.forEach(img => {
                        html += `
                            <a href="${img.url}" data-fancybox="work-gallery-${index}" data-caption="${project.title}">
                                <img src="${img.url}" alt="${project.title}" />
                            </a>
                        `;
                    });
                    html += '</div>';
                }

                html += '</div>'; // Close project-work-item
                
                if (index < project.works.length - 1) {
                    html += '<hr class="project-separator">';
                }
            });
        }

        html += '</div>'; // Close project-modal-details

        return html;
    }

    renderProjectModalError() {
        this.projectModalLoading.style.display = 'none';
        this.projectModalDetails.style.display = 'block';
        this.projectModalDetails.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <h2>Error Loading Project</h2>
                <p>Sorry, we couldn't load the project details. Please try again later.</p>
            </div>
        `;
    }

    closeProjectModal() {
        if (!this.projectModalOverlay) return;

        this.projectModalOverlay.classList.remove('active');
        document.body.style.overflow = '';
        
        // Clean up fancybox instances
        if (window.Fancybox) {
            window.Fancybox.destroy();
        }
    }

    // Test function to manually trigger animations
    testAnimations() {
        const allSections = [...this.invertedSections, ...this.nonInvertedSections];
        allSections.forEach((section, index) => {
            this.animateSectionSequentially(section);
        });
    }
}

// Initialize the App when the page is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    
    // Expose test function globally for debugging
    window.testAnimations = () => {
        window.app.testAnimations();
    };
});
