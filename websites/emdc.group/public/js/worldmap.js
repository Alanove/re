/**
 * WorldMap Class - Encapsulates all map functionality
 * Handles interactive world map with project locations
 */
class WorldMap {
  constructor() {
    this.mapObserver = null;
    this.pointersData = []; // Store pointer data until map becomes visible
    this.mapVisible = false; // Track visibility state
    
    // Map countries to regions for grouping
    this.countryToRegionMap = {
      'Canada': 'Americas',
      'Latin America': 'Americas',
      'Benin': 'Africa',
      'Congo': 'Africa',
      'Côte d\'Ivoire': 'Africa',
      'Cote d\'Ivoire': 'Africa',
      'Egypt': 'Africa',
      'Nigeria': 'Africa',
      'Tanzania': 'Africa',
      'Iraq': 'Gulf and Middle East',
      'Lebanon': 'Gulf and Middle East',
      'UAE': 'Gulf and Middle East',
      'Saudi Arabia': 'Saudi Arabia'
    };
    
    // Region center coordinates (representative locations for each region)
    this.regionCenters = {
      'Americas': { x: 450, y: 250 }, // Central North America
      'Africa': { x: 1100, y: 400 }, // Central Africa - positioned near visible buttons
      'Gulf and Middle East': { x: 1200, y: 290 }, // Middle East
      'Saudi Arabia': { x: 1220, y: 340 } // Saudi Arabia
    };
    
    this.countryMapping = {
      'Saudi Arabia': { 
        codes: ['SA', 'saudi-arabia', 'ksa'],
        center: { x: 1240, y: 340 },
        cities: {
          'Riyadh': { x: 1240, y: 340 }
        }
      },
      'Egypt': {
        codes: ['EG', 'egypt'],
        center: { x: 1145, y: 320 },
        cities: {
          'Cairo': { x: 1145, y: 320 }
        }
      },
      'UAE': { 
        codes: ['AE', 'united-arab-emirates', 'uae'],
        center: { x: 1280, y: 340 },
        cities: {
          'Dubai': { x: 1280, y: 370 }
        }
      },
      'Lebanon': { 
        codes: ['LB', 'lebanon'],
        center: { x: 1182, y: 285 },
        cities: {
          'Beirut': { x: 1182, y: 285 },
          'Jal el Dib': { x: 1180, y: 287 },
          'Jal El Dib': { x: 1180, y: 287 }
        }
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
        codes: ['CU', 'Latin America'],
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

  // Convert lat/lng to SVG coordinates
  // SVG viewBox is 0 0 2000 857
  latLngToSVG(lat, lng) {
    // Longitude: -180 to 180 maps to x: 0 to 2000
    // Latitude: 90 to -90 maps to y: 0 to 857
    const x = ((lng + 180) / 360) * 2000;
    const y = ((90 - lat) / 180) * 857;
    return { x, y };
  }

  // Initialize contact map with office locations
  initContactMap() {
    // Clean up previous observer
    if (this.mapObserver) {
      this.mapObserver.disconnect();
      this.mapObserver = null;
    }
    
    // Reset visibility state for contact map
    this.mapVisible = false;
    this.officesData = [];
    
    const mapContainer = document.getElementById('contactMapContainer');
    
    if (!mapContainer) {
      return;
    }
    
    // Get offices from data attribute
    let offices = [];
    try {
      const officesData = mapContainer.getAttribute('data-offices');
      offices = officesData ? JSON.parse(officesData) : [];
      console.log('Loaded offices:', offices);
    } catch (e) {
      console.error('Error parsing offices data:', e);
    }
    
    if (offices.length === 0) {
      console.warn('No office locations found');
      return;
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
          
          // Force responsive attributes
          svg.removeAttribute('width');
          svg.removeAttribute('height');
          svg.setAttribute('width', '100%');
          svg.style.width = '100%';
          svg.style.height = 'auto';
          svg.style.maxWidth = '100%';
          
          // Ensure proper viewBox is set for responsiveness
          if (!svg.getAttribute('viewBox')) {
            const originalWidth = svg.getAttribute('data-original-width') || '2000';
            const originalHeight = svg.getAttribute('data-original-height') || '857';
            svg.setAttribute('viewBox', `0 0 ${originalWidth} ${originalHeight}`);
          }
          
          // Store office data for markers
          this.officesData = offices.map(office => {
            let svgCoords = null;
            
            // First, try to find by country and city in countryMapping
            const countryData = this.countryMapping[office.country];
            if (countryData) {
              // Check if there's a city-specific coordinate (case-insensitive)
              if (countryData.cities) {
                const cityKey = Object.keys(countryData.cities).find(
                  key => key.toLowerCase() === office.city.toLowerCase()
                );
                if (cityKey) {
                  svgCoords = countryData.cities[cityKey];
                  console.log(`✓ Found city coordinates: ${office.city}, ${office.country} ->`, svgCoords);
                } else if (countryData.center) {
                  svgCoords = countryData.center;
                  console.log(`⚠ Using country center for ${office.city}, ${office.country}:`, svgCoords);
                }
              } else if (countryData.center) {
                svgCoords = countryData.center;
                console.log(`⚠ Using country center for ${office.city}, ${office.country}:`, svgCoords);
              }
            }
            
            // If not found in mapping, try coordinate conversion
            if (!svgCoords && office.coordinates) {
              try {
                const coords = office.coordinates.split(',').map(c => parseFloat(c.trim()));
                if (coords.length === 2 && !isNaN(coords[0]) && !isNaN(coords[1])) {
                  svgCoords = this.latLngToSVG(coords[0], coords[1]);
                  console.log(`✓ Converted lat/lng for ${office.city}, ${office.country}:`, coords, '->', svgCoords);
                }
              } catch (e) {
                console.warn('Error converting coordinates for office:', office.city, e);
              }
            }
            
            // Fallback to country center if still no coordinates
            if (!svgCoords && countryData && countryData.center) {
              svgCoords = countryData.center;
              console.log(`⚠ Fallback to country center for ${office.city}, ${office.country}:`, svgCoords);
            }
            
            if (!svgCoords) {
              console.error(`✗ Could not determine coordinates for office: ${office.city}, ${office.country}`);
              return null;
            }
            
            return {
              ...office,
              svgCoords
            };
          }).filter(office => office !== null);
          
          console.log('Final processed offices:', this.officesData.map(o => `${o.city} (${o.svgCoords.x}, ${o.svgCoords.y})`));
          
          // Set up intersection observer to trigger animation when map becomes visible
          this.setupContactMapObserver(svg);
          
        } else {
          console.error('SVG element not found after loading');
        }
      })
      .catch(error => {
        console.error('Error loading world SVG:', error);
        mapContainer.innerHTML = '<div class="map-error">Error loading world map: ' + error.message + '</div>';
      });
  }

  // Set up intersection observer for contact map
  setupContactMapObserver(svg) {
    const mapContainer = document.getElementById('contactMapContainer');
    
    if (!mapContainer) {
      console.warn('Contact map container not found for intersection observer');
      return;
    }

    // Function to trigger markers animation
    const triggerMarkersAnimation = () => {
      if (!this.mapVisible) {
        this.mapVisible = true;
        
        // Trigger the markers animation now that the map is visible
        setTimeout(() => {
          this.createOfficeMarkers(this.officesData, svg);
        }, 200);
        
        // Disconnect observer after first trigger
        if (this.mapObserver) {
          this.mapObserver.disconnect();
          this.mapObserver = null;
        }
      }
    };

    // Check if we're dealing with hash navigation
    const isHashNavigation = window.location.hash === '#contact-map';
    
    // For hash navigation, add extra delay
    if (isHashNavigation) {
      setTimeout(() => {
        if (!this.mapVisible) {
          triggerMarkersAnimation();
        }
      }, 800);
      return;
    }

    // Check if map is already visible
    const rect = mapContainer.getBoundingClientRect();
    const isCurrentlyVisible = rect.top < window.innerHeight && rect.bottom > 0;
    
    if (isCurrentlyVisible) {
      triggerMarkersAnimation();
      return;
    }

    // Create intersection observer
    this.mapObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          triggerMarkersAnimation();
        }
      });
    }, {
      threshold: 0.2,
      rootMargin: '50px'
    });

    // Start observing the map container
    this.mapObserver.observe(mapContainer);
  }

  // Create office markers with click handlers
  createOfficeMarkers(offices, svg) {
    // Check if markers already exist
    const existingMarkers = svg.querySelectorAll('.office-marker');
    if (existingMarkers.length > 0) {
      return;
    }
    
    if (offices.length === 0) {
      console.warn('No offices to create markers for!');
      return;
    }
    
    // Remove any existing tooltip
    const existingTooltip = document.getElementById('office-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
    }
    
    offices.forEach((office, index) => {
      const baseDelay = 60;
      setTimeout(() => {
        // Create SVG group for the map pin marker
        const markerGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        markerGroup.setAttribute('class', 'office-marker');
        markerGroup.setAttribute('data-office-id', office.id);
        markerGroup.style.cursor = 'pointer';
        markerGroup.style.opacity = '0';
        
        // Marker size - larger for better visibility
        const markerSize = window.innerWidth <= 480 ? 50 : (window.innerWidth <= 768 ? 46 : 42);
        
        // Position marker so the point (bottom) is at the coordinates
        markerGroup.setAttribute('transform', `translate(${office.svgCoords.x}, ${office.svgCoords.y})`);
        
        // Load and use the marker SVG
        fetch('/images/map-marker.svg')
          .then(response => response.text())
          .then(svgContent => {
            // Parse the SVG content
            const parser = new DOMParser();
            const markerDoc = parser.parseFromString(svgContent, 'image/svg+xml');
            const markerSvg = markerDoc.documentElement;
            
            if (markerSvg && markerSvg.tagName === 'svg') {
              // Extract all elements from the marker SVG
              const markerElements = Array.from(markerSvg.children);
              
              // Create a group to hold the marker, positioned so the point is at coordinates
              const markerUse = document.createElementNS('http://www.w3.org/2000/svg', 'g');
              // The SVG viewBox is 0 0 1200 1200, with the point at bottom (y=1200, x=600)
              // Scale marker and position so point (bottom center) is at (0,0) in markerGroup
              const scale = markerSize / 1200; // Scale to desired size
              markerUse.setAttribute('transform', `translate(${-600 * scale}, ${-1200 * scale}) scale(${scale})`);
              
              // Clone and append all elements from the marker SVG
              markerElements.forEach(element => {
                const cloned = element.cloneNode(true);
                markerUse.appendChild(cloned);
              });
              
              markerGroup.appendChild(markerUse);
              
              // Store elements for hover effects
              const paths = markerUse.querySelectorAll('path');
              
              // Set initial marker color to white
              paths.forEach(path => {
                path.setAttribute('fill', '#ffffff');
              });
              
              // Add opacity animation
              const opacityAnimate = document.createElementNS('http://www.w3.org/2000/svg', 'animate');
              opacityAnimate.setAttribute('attributeName', 'opacity');
              opacityAnimate.setAttribute('values', '0;1');
              opacityAnimate.setAttribute('dur', '0.3s');
              opacityAnimate.setAttribute('fill', 'freeze');
              opacityAnimate.setAttribute('begin', `${index * 0.1}s`);
              
              // Ensure opacity is set to 1 after animation completes
              const animationDelay = (index * 0.1) + 0.3;
              setTimeout(() => {
                markerGroup.setAttribute('opacity', '1');
                markerGroup.style.opacity = '1';
              }, animationDelay * 1000);
              
              opacityAnimate.addEventListener('endEvent', () => {
                markerGroup.setAttribute('opacity', '1');
                markerGroup.style.opacity = '1';
                opacityAnimate.remove();
              });
              
              // Also listen for the animation end using different event names for browser compatibility
              opacityAnimate.addEventListener('end', () => {
                markerGroup.setAttribute('opacity', '1');
                markerGroup.style.opacity = '1';
              });
              
              markerGroup.appendChild(opacityAnimate);
              
              // Add click event listener to show office info
              markerGroup.addEventListener('click', (e) => {
                e.stopPropagation();
                this.showOfficeInfo(office, markerGroup, svg);
              });
              
              // Add hover effect - change to brand blue on hover
              markerGroup.addEventListener('mouseenter', () => {
                paths.forEach(path => {
                  path.setAttribute('fill', '#203864');
                });
                markerGroup.setAttribute('transform', `translate(${office.svgCoords.x}, ${office.svgCoords.y}) scale(1.15)`);
              });
              
              markerGroup.addEventListener('mouseleave', () => {
                paths.forEach(path => {
                  path.setAttribute('fill', '#ffffff');
                });
                markerGroup.setAttribute('transform', `translate(${office.svgCoords.x}, ${office.svgCoords.y})`);
              });
              
              // Add pointer to SVG
              svg.appendChild(markerGroup);
            }
          })
          .catch(error => {
            console.error('Error loading marker SVG:', error);
            // Fallback: create a simple circle if SVG fails to load
            const fallbackCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            fallbackCircle.setAttribute('cx', office.svgCoords.x);
            fallbackCircle.setAttribute('cy', office.svgCoords.y);
            fallbackCircle.setAttribute('r', '15');
            fallbackCircle.setAttribute('fill', '#ffffff');
            fallbackCircle.setAttribute('stroke', '#203864');
            fallbackCircle.setAttribute('stroke-width', '3');
            fallbackCircle.setAttribute('class', 'office-marker');
            fallbackCircle.setAttribute('data-office-id', office.id);
            fallbackCircle.style.cursor = 'pointer';
            fallbackCircle.style.opacity = '1';
            svg.appendChild(fallbackCircle);
          });
        
      }, index * 100);
    });
  }

  // Show office information tooltip
  showOfficeInfo(office, marker, svg) {
    // Remove existing tooltip
    const existingTooltip = document.getElementById('office-tooltip');
    if (existingTooltip) {
      existingTooltip.remove();
    }
    
    // Create tooltip element with inline styles to ensure it displays correctly
    const tooltip = document.createElement('div');
    tooltip.id = 'office-tooltip';
    tooltip.className = 'office-tooltip';
    
    // Apply inline styles to ensure tooltip is visible
    tooltip.style.cssText = `
      background: #203864;
      backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 8px;
      padding: 20px;
      min-width: 250px;
      max-width: 350px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      color: #ffffff;
      font-family: inherit;
      position: fixed;
      z-index: 10000;
    `;
    
    tooltip.innerHTML = `
      <div class="office-tooltip-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid rgba(255, 255, 255, 0.2);">
        <h4 style="margin: 0; font-size: 1.2rem; font-weight: 600; color: #ffffff;">${office.city} Office</h4>
        <button class="office-tooltip-close" aria-label="Close" style="background: none; border: none; color: #ffffff; font-size: 1.5rem; cursor: pointer; padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; transition: opacity 0.2s ease;">&times;</button>
      </div>
      <div class="office-tooltip-body">
        <p class="office-tooltip-address" style="margin: 0 0 12px 0; font-size: 0.95rem; line-height: 1.6; color: #ffffff; opacity: 0.9;">${office.address}</p>
        <p class="office-tooltip-phone" style="margin: 0; font-size: 0.95rem; color: #ffffff;">
          <strong style="font-weight: 600; opacity: 0.8; margin-right: 8px;">Phone:</strong> 
          <a href="tel:${office.phone.replace(/\s/g, '')}" style="color: #ffffff; text-decoration: none; transition: opacity 0.2s ease;">${office.phone}</a>
        </p>
      </div>
    `;
    
    // Add close button handler
    const closeBtn = tooltip.querySelector('.office-tooltip-close');
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      tooltip.remove();
    });
    
    // Add hover effect to close button
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.opacity = '0.7';
    });
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.opacity = '1';
    });
    
    // Add hover effect to phone link
    const phoneLink = tooltip.querySelector('.office-tooltip-phone a');
    if (phoneLink) {
      phoneLink.addEventListener('mouseenter', () => {
        phoneLink.style.opacity = '0.8';
        phoneLink.style.textDecoration = 'underline';
      });
      phoneLink.addEventListener('mouseleave', () => {
        phoneLink.style.opacity = '1';
        phoneLink.style.textDecoration = 'none';
      });
    }
    
    // Close on outside click
    document.addEventListener('click', function closeTooltip(e) {
      if (!tooltip.contains(e.target) && e.target !== marker) {
        tooltip.remove();
        document.removeEventListener('click', closeTooltip);
      }
    });
    
    // Position tooltip near the marker
    const svgRect = svg.getBoundingClientRect();
    // Handle both circle markers (home page) and group markers (contact page)
    let markerX, markerY;
    if (marker.tagName === 'circle') {
      markerX = parseFloat(marker.getAttribute('cx'));
      markerY = parseFloat(marker.getAttribute('cy'));
    } else if (marker.tagName === 'g') {
      const transform = marker.getAttribute('transform');
      const match = transform.match(/translate\(([^,]+),([^)]+)\)/);
      if (match) {
        markerX = parseFloat(match[1]);
        markerY = parseFloat(match[2]);
      } else {
        markerX = 0;
        markerY = 0;
      }
    } else {
      markerX = 0;
      markerY = 0;
    }
    
    // Convert SVG coordinates to screen coordinates
    const viewBox = svg.getAttribute('viewBox').split(' ').map(Number);
    const scaleX = svgRect.width / viewBox[2];
    const scaleY = svgRect.height / viewBox[3];
    
    const screenX = svgRect.left + (markerX * scaleX);
    const screenY = svgRect.top + (markerY * scaleY);
    
    // Position tooltip
    tooltip.style.position = 'fixed';
    tooltip.style.left = `${screenX + 20}px`;
    tooltip.style.top = `${screenY - 100}px`;
    tooltip.style.zIndex = '10000';
    
    // Adjust if tooltip goes off screen
    setTimeout(() => {
      const tooltipRect = tooltip.getBoundingClientRect();
      if (tooltipRect.right > window.innerWidth) {
        tooltip.style.left = `${screenX - tooltipRect.width - 20}px`;
      }
      if (tooltipRect.top < 0) {
        tooltip.style.top = `${screenY + 20}px`;
      }
    }, 0);
    
    document.body.appendChild(tooltip);
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
          
          // Group countries by regions and create one dot per region
          const regionGroups = {};
          const countriesByRegion = {};
          
          // Check which countries have projects and group them by region
          // Handle both array and object formats for countriesWithProjects
          if (Array.isArray(countriesWithProjects)) {
            // If it's an array of country names
            countriesWithProjects.forEach(country => {
              const region = this.countryToRegionMap[country] || 'Other';
              if (!regionGroups[region]) {
                regionGroups[region] = true;
                countriesByRegion[region] = [];
              }
              countriesByRegion[region].push(country);
            });
          } else if (typeof countriesWithProjects === 'object') {
            // If it's an object with countries as keys
            for (const [country] of Object.entries(countriesWithProjects)) {
              const region = this.countryToRegionMap[country] || 'Other';
              if (!regionGroups[region]) {
                regionGroups[region] = true;
                countriesByRegion[region] = [];
              }
              countriesByRegion[region].push(country);
            }
          }
          
          // Create one pointer per region
          const pointersToCreate = [];
          for (const [region, countries] of Object.entries(countriesByRegion)) {
            const regionCenter = this.regionCenters[region];
            if (regionCenter) {
              console.log(`Creating pointer for region: ${region} at (${regionCenter.x}, ${regionCenter.y}) with countries:`, countries);
              pointersToCreate.push({
                region: region,
                countries: countries,
                center: regionCenter
              });
            } else {
              console.warn(`No region center found for region: ${region}`);
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
        // Store region and countries data
        pointer.setAttribute('data-region', pointerData.region);
        pointer.setAttribute('data-countries', JSON.stringify(pointerData.countries || []));
        
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
        
        // Ensure opacity is set to 1 after animation completes
        const animationDelay = (index * 0.1) + 0.3;
        setTimeout(() => {
          pointer.setAttribute('opacity', '1');
          pointer.style.opacity = '1';
        }, animationDelay * 1000);
        
        // Remove the animation element after it completes to avoid conflicts with CSS
        opacityAnimate.addEventListener('endEvent', () => {
          pointer.setAttribute('opacity', '1');
          pointer.style.opacity = '1';
          opacityAnimate.remove();
        });
        
        // Also listen for the animation end using different event names for browser compatibility
        opacityAnimate.addEventListener('end', () => {
          pointer.setAttribute('opacity', '1');
          pointer.style.opacity = '1';
        });
        
        pointer.appendChild(opacityAnimate);
        
        // Add click event listener for navigation to region
        pointer.addEventListener('click', (e) => {
          const regionName = e.target.getAttribute('data-region');
          if (regionName) {
            const slug = this.slugifyCountry(regionName);
            window.location.href = `/projects/regions/${slug}`;
          }
        });
        
        // Add hover tooltip showing region name and countries
        pointer.addEventListener('mouseenter', (e) => {
          const regionName = e.target.getAttribute('data-region');
          const countriesJson = e.target.getAttribute('data-countries');
          const countries = countriesJson ? JSON.parse(countriesJson) : [];
          
          // Create tooltip
          const tooltip = document.createElement('div');
          tooltip.id = 'region-tooltip';
          tooltip.style.cssText = `
            position: fixed;
            background: #203864;
            color: white;
            padding: 10px 15px;
            border-radius: 6px;
            font-size: 0.9rem;
            z-index: 10000;
            pointer-events: none;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            max-width: 250px;
          `;
          
          let tooltipContent = `<strong>${regionName}</strong>`;
          if (countries.length > 0) {
            tooltipContent += `<br><small style="opacity: 0.8;">${countries.join(', ')}</small>`;
          }
          tooltip.innerHTML = tooltipContent;
          
          document.body.appendChild(tooltip);
          
          // Position tooltip
          const svgRect = svg.getBoundingClientRect();
          const viewBox = svg.getAttribute('viewBox').split(' ').map(Number);
          const scaleX = svgRect.width / viewBox[2];
          const scaleY = svgRect.height / viewBox[3];
          const screenX = svgRect.left + (pointerData.center.x * scaleX);
          const screenY = svgRect.top + (pointerData.center.y * scaleY);
          
          tooltip.style.left = `${screenX + 20}px`;
          tooltip.style.top = `${screenY - 60}px`;
        });
        
        pointer.addEventListener('mouseleave', () => {
          const tooltip = document.getElementById('region-tooltip');
          if (tooltip) {
            tooltip.remove();
          }
        });
        
        // Add pointer to SVG
        svg.appendChild(pointer);
        
      }, index * 100); // 100ms delay between each pointer
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
