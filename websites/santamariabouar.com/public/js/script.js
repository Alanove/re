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
        this.setupScrollArrow();
        this.setupBurgerMenu();
        this.setupMemberMenu();
        this.setupProjectModal();
        this.setupMobileProjectsFilter();
        this.initWorldMap();
        this.delayedInit();
        this.handleInitialHashtag();
    }

    initHtmlElements() {
        this.header = document.querySelector('.site-header') || document.querySelector('header');
        this.burgerMenu = document.querySelector('#burgerMenu') || document.querySelector('.burger-menu');
        this.fullscreenMenu = document.querySelector('#fullscreenMenu');
        this.fullscreenCloseBtn = document.querySelector('#fullscreenCloseBtn');
        this.fullscreenMenuBackdrop = document.querySelector('#fullscreenMenuBackdrop');
        this.memberMenuBtn = document.querySelector('#memberMenuBtn');
        this.memberMenu = document.querySelector('#memberMenu');
        this.memberMenuBackdrop = document.querySelector('#memberMenuBackdrop');
        this.memberMenuCloseBtn = document.querySelector('#memberMenuCloseBtn');
        this.invertedSections = document.querySelectorAll('.main>section.inverted');
        this.nonInvertedSections = document.querySelectorAll('.main>section:not(.inverted)');
        this.footerTopButton = document.querySelector('#footerTopButton');
        this.heroQuotes = document.querySelector('.hero-quotes');
        this.loader = document.querySelector('#pageLoader');
        
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
        // Reveal as soon as DOM is ready — do not wait for hero video/media
        // (window "load" blocks on preload media and makes the home page feel stuck)
        const reveal = () => this.hideLoader();

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', reveal, { once: true });
        } else {
            reveal();
        }

        window.addEventListener('load', reveal, { once: true });

        // Fallback: never keep the full-page loader longer than 2.5s
        setTimeout(reveal, 2500);
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
            // Update visible elements
            this.updateVisibleElements();
            
            // Animate project stats
            this.animateProjectStats();
        });
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
                element.style.transition = 'opacity 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94), transform 0.6s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                
                // Animate to final state
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
                
                // After animation completes, restore original transition
                setTimeout(() => {
                    element.style.transition = element.dataset.originalTransition;
                }, 600); // Match our animation duration
                
            }, index * 100); // 100ms delay between each element for faster sequential animation
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
        
        const updateNumber = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // Use easeOutCubic for smooth deceleration
            const easeProgress = 1 - Math.pow(1 - progress, 3);
            const currentValue = Math.floor(start + (range * easeProgress));
            
            // Update the element's text content
            element.textContent = currentValue.toLocaleString();
            
            // Continue animation if not complete
            if (progress < 1) {
                requestAnimationFrame(updateNumber);
            } else {
                // Ensure final value is exactly the target
                element.textContent = end.toLocaleString();
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

        // Add escape key listener to close menus
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                if (this.fullscreenMenu && this.fullscreenMenu.classList.contains('is-open')) {
                    this.closeFullscreenMenu();
                }
                if (this.memberMenu && this.memberMenu.classList.contains('is-open')) {
                    this.closeMemberMenu();
                }
            }
        });

        if (this.fullscreenMenuBackdrop) {
            this.fullscreenMenuBackdrop.addEventListener('click', () => {
                this.closeFullscreenMenu();
            });
        }

        // Close when navigating (main menu has no submenu toggles)
        this.fullscreenMenu.addEventListener('click', (e) => {
            if (e.target.tagName === 'A') {
                this.closeFullscreenMenu();
            }
        });

        this.setupHorizontalSubmenuInteractions();
    }

    setupHorizontalSubmenuInteractions() {
        const horizontalMenu = document.querySelector('.site-header__nav ul');
        if (!horizontalMenu) return;

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

    toggleFullscreenMenu() {
        if (this.fullscreenMenu.classList.contains('is-open')) {
            this.closeFullscreenMenu();
        } else {
            this.openFullscreenMenu();
        }
    }

    openFullscreenMenu() {
        this.closeMemberMenu();
        this.openSlideMenu(this.fullscreenMenu, this.burgerMenu, this.fullscreenMenuBackdrop);
        if (this.burgerMenu) {
            this.burgerMenu.classList.add('active');
        }
    }

    closeFullscreenMenu() {
        this.closeSlideMenu(this.fullscreenMenu, this.burgerMenu, this.fullscreenMenuBackdrop);
        if (this.burgerMenu) {
            this.burgerMenu.classList.remove('active');
        }
    }

    openSlideMenu(panel, triggerBtn, backdrop) {
        if (!panel) return;

        panel.classList.add('is-open');

        if (triggerBtn) {
            triggerBtn.classList.add('is-active');
            triggerBtn.setAttribute('aria-expanded', 'true');
        }

        if (backdrop) {
            backdrop.classList.add('is-open');
        }

        document.body.classList.add('slide-menu-open');
    }

    closeSlideMenu(panel, triggerBtn, backdrop) {
        if (!panel) return;

        panel.classList.remove('is-open');

        if (triggerBtn) {
            triggerBtn.classList.remove('is-active');
            triggerBtn.setAttribute('aria-expanded', 'false');
        }

        if (backdrop) {
            backdrop.classList.remove('is-open');
        }

        if (
            !this.fullscreenMenu?.classList.contains('is-open') &&
            !this.memberMenu?.classList.contains('is-open')
        ) {
            document.body.classList.remove('slide-menu-open');
        }
    }

    setupMemberMenu() {
        if (!this.memberMenuBtn || !this.memberMenu) return;

        this.memberMenuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            this.toggleMemberMenu();
        });

        if (this.memberMenuCloseBtn) {
            this.memberMenuCloseBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.closeMemberMenu();
            });
        }

        if (this.memberMenuBackdrop) {
            this.memberMenuBackdrop.addEventListener('click', () => {
                this.closeMemberMenu();
            });
        }

        this.memberMenu.addEventListener('click', (e) => {
            if (e.target.tagName === 'A') {
                this.closeMemberMenu();
            }
        });
    }

    toggleMemberMenu() {
        if (this.memberMenu.classList.contains('is-open')) {
            this.closeMemberMenu();
        } else {
            this.openMemberMenu();
        }
    }

    openMemberMenu() {
        if (!this.memberMenu || !this.memberMenuBtn) return;

        this.closeFullscreenMenu();
        this.openSlideMenu(this.memberMenu, this.memberMenuBtn, this.memberMenuBackdrop);
    }

    closeMemberMenu() {
        if (!this.memberMenu || !this.memberMenuBtn) return;

        this.closeSlideMenu(this.memberMenu, this.memberMenuBtn, this.memberMenuBackdrop);
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

    setupHeroQuotes() {
        // Check if hero quotes element exists
        if (!this.heroQuotes) return;

        // Get all quote items
        const quoteItems = this.heroQuotes.querySelectorAll('.quote-item');
        
        // If no quote items found, return
        if (quoteItems.length === 0) return;

        // Show first quote initially
        this.showQuote(quoteItems, 0);

        // Start rotation if there are multiple quotes
        if (quoteItems.length > 1) {
            this.startQuotesRotation(quoteItems);
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
    }

    delayedInit() {
        // Delay execution to ensure all elements are properly rendered
        setTimeout(() => {
            // Set initial visibility state for sections
            this.updateVisibleElements();
            
            // Check for stats to animate on initial load
            this.animateProjectStats();
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
            { key: 'client', label: 'Client' }
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

function setupAccountYearFilters() {
    document.querySelectorAll('.account-filter select.js-year-filter').forEach((select) => {
        select.addEventListener('change', () => {
            const form = select.closest('form');
            if (form) {
                form.submit();
            }
        });
    });
}

// Initialize the App when the page is ready
document.addEventListener('DOMContentLoaded', () => {
    setupAccountYearFilters();
    window.app = new App();
    
    // Expose test function globally for debugging
    window.testAnimations = () => {
        window.app.testAnimations();
    };
});
