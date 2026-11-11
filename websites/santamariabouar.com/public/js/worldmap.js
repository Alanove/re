/**
 * WorldMap Class - Encapsulates all map functionality
 * Handles interactive world map with project locations
 */
class WorldMap {
  constructor() {
    this.mapObserver = null;
    this.pointersData = []; // Store pointer data until map becomes visible
    this.mapVisible = false; // Track visibility state
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
        codes: ['CI', 'cote-divoire', 'ivory-coast', 'cote-d-ivoire'],
        center: { x: 950, y: 420 } // Moved further left of Congo (1080, 470) and adjusted y
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
    // Clean up previous observer
    if (this.mapObserver) {
      this.mapObserver.disconnect();
      this.mapObserver = null;
    }
    
    const mapContainer = document.getElementById('worldMapContainer');
    
    if (!mapContainer) {
      return;
    }
    
    // Get countries with projects from data attribute
    let countriesWithProjects = [];
    let projectsByCountry = {};
    try {
      const countriesData = mapContainer.getAttribute('data-countries');
      countriesWithProjects = countriesData ? JSON.parse(countriesData) : [];
    } catch (e) {
      console.error('Error parsing countries data:', e);
    }
    
    fetch('/images/world.svg')
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.text();
      })
      .then(svgContent => {
        // Insert SVG content
        mapContainer.innerHTML = svgContent;
        
        // Get the SVG element and add class
        const svg = mapContainer.querySelector('svg');
        if (svg) {
          svg.classList.add('world-map-svg');
          
          // Force responsive attributes to prevent horizontal scrolling
          svg.removeAttribute('width');
          svg.removeAttribute('height');
          svg.setAttribute('width', '100%');
          // Don't set height attribute to 'auto' - let CSS handle it
          svg.style.width = '100%';
          svg.style.height = 'auto';
          svg.style.maxWidth = '100%';
          
          // Ensure proper viewBox is set for responsiveness
          if (!svg.getAttribute('viewBox')) {
            // Get original dimensions if available
            const originalWidth = svg.getAttribute('data-original-width') || '2000';
            const originalHeight = svg.getAttribute('data-original-height') || '1000';
            svg.setAttribute('viewBox', `0 0 ${originalWidth} ${originalHeight}`);
          }
          
          // Create some basic pointers for testing
          const pointersToCreate = [];
          
          // Check which countries have projects and collect them
          // Handle both array and object formats for countriesWithProjects
          if (Array.isArray(countriesWithProjects)) {
            // If it's an array of country names
            countriesWithProjects.forEach(country => {
              let countryData = this.countryMapping[country];
              
              // If direct match fails, try to find by alternative codes
              if (!countryData) {
                for (const [mappedCountry, data] of Object.entries(this.countryMapping)) {
                  if (data.codes && data.codes.some(code => 
                    code.toLowerCase() === country.toLowerCase() ||
                    country.toLowerCase().includes(code.toLowerCase()) ||
                    code.toLowerCase().includes(country.toLowerCase())
                  )) {
                    countryData = data;
                    break;
                  }
                }
              }
              
              if (countryData && countryData.center) {
                pointersToCreate.push({
                  country: country,
                  center: countryData.center
                });
              } else {
                console.warn(`No mapping found for country: "${country}". Available countries:`, Object.keys(this.countryMapping));
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
          
          // Store pointer data instead of creating them immediately
          this.pointersData = pointersToCreate;
          
          // Set up intersection observer to trigger animation when map becomes visible
          this.setupIntersectionObserver(svg);
          
        } else {
          console.error('SVG element not found after loading');
        }
      })
      .catch(error => {
        console.error('Error loading world SVG:', error);
        mapContainer.innerHTML = '<div class="map-error">Error loading world map: ' + error.message + '</div>';
      });
  }

  // Set up intersection observer to detect when map becomes visible
  setupIntersectionObserver(svg) {
    const mapContainer = document.getElementById('worldMapContainer');
    
    if (!mapContainer) {
      console.warn('Map container not found for intersection observer');
      return;
    }

    // Function to trigger dots animation
    const triggerDotsAnimation = () => {
      if (!this.mapVisible) {
        this.mapVisible = true;
        
        // Trigger the dots animation now that the map is visible
        setTimeout(() => {
          this.createSVGPointersSequentially(this.pointersData, svg);
        }, 200);
        
        // Disconnect observer after first trigger (dots should only animate once)
        if (this.mapObserver) {
          this.mapObserver.disconnect();
          this.mapObserver = null;
        }
      }
    };

    // Check if we're dealing with hash navigation to locations
    const isHashNavigation = window.location.hash === '#locations';
    
    // For hash navigation, add extra delay to avoid race conditions
    if (isHashNavigation) {
      setTimeout(() => {
        if (!this.mapVisible) {
          triggerDotsAnimation();
        }
      }, 800); // Wait for hash scroll animation to complete
      return; // No need to set up observer for hash navigation
    }

    // Check if map is already visible (for page refresh scenarios)
    const rect = mapContainer.getBoundingClientRect();
    const isCurrentlyVisible = rect.top < window.innerHeight && rect.bottom > 0;
    
    if (isCurrentlyVisible) {
      triggerDotsAnimation();
      return; // No need to set up observer
    }

    // Create intersection observer for when map comes into view
    this.mapObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          triggerDotsAnimation();
        }
      });
    }, {
      threshold: 0.2, // Trigger when 20% of the map is visible
      rootMargin: '50px' // Start animation 50px before the map enters viewport
    });

    // Start observing the map container
    this.mapObserver.observe(mapContainer);
  }

  // Create SVG pointers sequentially with animation delay
  createSVGPointersSequentially(pointersToCreate, svg) {
    
    // Check if pointers are already being created or exist
    const existingPointers = svg.querySelectorAll('.country-pointer');
    if (existingPointers.length > 0) {
      return;
    }
    
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
        pointer.setAttribute('fill', '#203864'); // Use consistent brand blue
        pointer.setAttribute('stroke', 'white');
        pointer.setAttribute('stroke-width', '3');
        pointer.setAttribute('opacity', '0');
        pointer.setAttribute('data-country', pointerData.country);
        
        // Ensure the pointer is visible by setting a fallback color
        pointer.style.fill = '#203864';
        pointer.style.stroke = 'white';
        pointer.style.strokeWidth = '3px';
        
        // Set CSS custom property for staggered animation
        pointer.style.setProperty('--pointer-index', index.toString());
        
        // Add opacity animation for entrance only
        const opacityAnimate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
        opacityAnimate.setAttribute('attributeName', 'opacity');
        opacityAnimate.setAttribute('values', '0;1');
        opacityAnimate.setAttribute('dur', '0.3s');
        opacityAnimate.setAttribute('fill', 'freeze');
        opacityAnimate.setAttribute('begin', `${index * 0.1}s`);
        
        // Remove the animation element after it completes to avoid conflicts with CSS
        opacityAnimate.addEventListener('endEvent', () => {
          opacityAnimate.remove();
        });
        
        pointer.appendChild(opacityAnimate);
        
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

// Export for modular usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = WorldMap;
}
