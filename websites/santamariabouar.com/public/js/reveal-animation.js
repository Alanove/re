// Reveal Animation Script
document.addEventListener('DOMContentLoaded', function() {
  console.log('Reveal animation script loaded');
  
  // Function to animate elements
  function animateElements(elements) {
    elements.forEach(function(element, index) {
      setTimeout(function() {
        element.classList.remove('hidden-animation');
        element.classList.add('revealed');
        console.log('Revealed element', index);
      }, index * 50);
    });
  }

  // Function to reset elements for re-animation
  function resetElements(elements) {
    elements.forEach(function(element) {
      element.classList.remove('revealed');
      element.classList.add('hidden-animation');
    });
  }

  // Setup Intersection Observer for repeated animations
  function setupRevealObserver() {
    const observerOptions = {
      threshold: 0.3,
      rootMargin: '0px 0px -50px 0px'
    };

    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          // Find all hidden-animation elements within the observed section
          const hiddenElements = entry.target.querySelectorAll('.hidden-animation');
          if (hiddenElements.length > 0) {
            animateElements(hiddenElements);
          }
        } else {
          // Reset animations when section goes out of view
          const revealedElements = entry.target.querySelectorAll('.revealed');
          if (revealedElements.length > 0) {
            resetElements(revealedElements);
          }
        }
      });
    }, observerOptions);

    // Observe sections that might contain animated elements
    const sectionsToObserve = document.querySelectorAll('.inner-page, .project-stats, .projects-map');
    sectionsToObserve.forEach(section => {
      revealObserver.observe(section);
    });

    // Also observe individual elements that might not be in sections
    const individualElements = document.querySelectorAll('.hidden-animation');
    individualElements.forEach(element => {
      revealObserver.observe(element);
    });
  }

  // Initial setup for elements that should have hidden-animation class
  setTimeout(function() {
    // Check if we're on the Our Success Indicators page
    const successIndicators = document.querySelectorAll('.inner-page.Our-Success-Indicators ul li');
    console.log('Found', successIndicators.length, 'success indicator list items');
    
    // Manually add hidden-animation class if not present
    successIndicators.forEach(function(element, index) {
      if (!element.classList.contains('hidden-animation')) {
        element.classList.add('hidden-animation');
        console.log('Added hidden-animation class to element', index);
      }
    });

    // Check if we're on the MEP & ICT page and add hidden-animation to grid items
    const mepServiceItems = document.querySelectorAll('.inner-page.what-we-do-mep-ict .mep-services-grid > li');
    console.log('Found', mepServiceItems.length, 'MEP service grid items');
    
    // Manually add hidden-animation class if not present
    mepServiceItems.forEach(function(element, index) {
      if (!element.classList.contains('hidden-animation')) {
        element.classList.add('hidden-animation');
        console.log('Added hidden-animation class to MEP grid item', index);
      }
    });

    // Check if we're on the Energy & Sustainability page and add hidden-animation to grid items
    const energyServiceItems = document.querySelectorAll('.inner-page.what-we-do-energy-sustainability .energy-services-grid > li');
    console.log('Found', energyServiceItems.length, 'Energy service grid items');
    
    // Manually add hidden-animation class if not present
    energyServiceItems.forEach(function(element, index) {
      if (!element.classList.contains('hidden-animation')) {
        element.classList.add('hidden-animation');
        console.log('Added hidden-animation class to Energy grid item', index);
      }
    });

    // Setup the observer for repeated animations
    setupRevealObserver();
  }, 50);
});
