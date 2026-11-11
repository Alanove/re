/**
 * WebGL Enhanced Slideshow
 * Maintains exact same functionality and timing as the original slideshow
 * with added WebGL effects for enhanced visual appeal
 */

class WebGLSlideshow {
  constructor(container, options = {}) {
    this.container = $(container);
    this.slides = this.container.find('.slide-container');
    this.currentIndex = 0;
    this.isAnimating = false;
    this.isPaused = false;
    this.autoSlideId = null;
    this.autoSlideTimeout = null;
    
    // Configuration - same as original
    this.slideDuration = options.slideDuration || 1000;
    this.viewDuration = options.viewDuration || 3000;
    this.totalDuration = this.slideDuration + this.viewDuration;
    
    // WebGL Effects Configuration
    this.effectType = options.effectType || 'fade'; // fade, slide, zoom, wave, ripple, windowslice, linearblur, morph, dreamy, wind, squarewire, fadeslide, random
    this.effectIntensity = options.effectIntensity || 1.0;
    this.effectSpeed = options.effectSpeed || 1.0;
    
    // Random Effect Pools
    this.imageEffectPool = options.imageEffectPool || ['fade', 'slide', 'zoom', 'wave', 'ripple'];
    this.textTransitionPool = options.textTransitionPool || ['fade', 'typewriter', 'slideup', 'slidedown'];
    
    // Text Transition Configuration
    this.textTransition = options.textTransition || 'fade'; // fade, typewriter, slideup, slidedown, random
    this.textTransitionDuration = options.textTransitionDuration || 800;
    
    // Brand Configuration
    this.brandName = options.brandName || 'Santa Maria Bouar';
    
    // Current active effects (for random mode)
    this.currentImageEffect = this.effectType;
    this.currentTextTransition = this.textTransition;
    
    // State tracking
    this.currentTime = 0;
    this.lastTimestamp = 0;
    
    // WebGL properties
    this.canvas = null;
    this.gl = null;
    this.program = null;
    this.textures = [];
    this.imageDimensions = []; // Store original image dimensions for aspect ratio
    this.imagesLoaded = 0;
    this.totalImages = 0;
    this.loader = null;
    this.initialDisplayReady = false;
    this.transitionProgress = 0;
    this.transitionStartTime = 0;
    this.isTransitioning = false;
    
    // WebGL uniforms and attributes
    this.uniforms = {};
    this.attributes = {};
    
    // Visibility tracking for performance optimization
    this.isVisible = true;
    this.intersectionObserver = null;
    this.visibilityObserver = null;
    
    this.init();
  }
  
  // Initialize visibility tracking for performance optimization
  initVisibilityTracking() {
    // Use Intersection Observer API to detect when slideshow is out of view
    if ('IntersectionObserver' in window) {
      this.intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              this.onSlideshowVisible();
            } else {
              this.onSlideshowHidden();
            }
          });
        },
        {
          threshold: 0.1, // Trigger when 10% of slideshow is visible
          rootMargin: '50px' // Add 50px margin for early detection
        }
      );
      
      // Start observing the slideshow container
      this.intersectionObserver.observe(this.container[0]);
    }
    
    // Fallback: Use Page Visibility API for when tab is not active
    if ('hidden' in document) {
      this.visibilityObserver = () => {
        if (document.hidden) {
          this.onSlideshowHidden();
        } else {
          this.onSlideshowVisible();
        }
      };
      
      document.addEventListener('visibilitychange', this.visibilityObserver);
    }
  }
  
  // Called when slideshow becomes visible
  onSlideshowVisible() {
    if (!this.isVisible) {
      this.isVisible = true;
      this.resumeWebGLRendering();
      this.resumeCurrentMedia();
      // Only resume auto-advance if the user has not hovered to pause
      if (!this.isPaused) {
        this.resumeSlideshow();
        console.log('👁️ Slideshow became visible - resuming');
      } else {
        console.log('👁️ Slideshow became visible but remains paused (manual pause)');
      }
    }
  }
  
  // Called when slideshow becomes hidden
  onSlideshowHidden() {
    if (this.isVisible) {
      this.isVisible = false;
      this.pauseCurrentMedia();
      this.pauseSlideshowTimers();
      this.pauseWebGLRendering();
      console.log('🙈 Slideshow hidden - pausing for performance');
    }
  }
  
  // Pause WebGL rendering for performance when slideshow is not visible
  pauseWebGLRendering() {
    if (this.canvas) {
      // Hide the canvas to stop rendering
      this.canvas.style.display = 'none';
      // Stop any ongoing WebGL animations
      if (this.gl && this.isTransitioning) {
        this.isTransitioning = false;
      }
    }
  }
  
  // Resume WebGL rendering when slideshow becomes visible
  resumeWebGLRendering() {
    if (!this.canvas) return;

    const currentSlide = this.slides.eq(this.currentIndex);
    const isCurrentVideo = currentSlide.attr('data-media-type') === 'video';

    // Never force the WebGL canvas over a video slide — that causes a black screen
    if (isCurrentVideo) {
      this.canvas.style.display = 'none';
      return;
    }

    this.canvas.style.display = 'block';
    this.canvas.style.opacity = '1';
  }

  pauseCurrentMedia() {
    const currentSlide = this.slides.eq(this.currentIndex);
    if (currentSlide.attr('data-media-type') !== 'video') return;

    const videoElement = currentSlide.find('video')[0];
    if (videoElement && !videoElement.paused) {
      videoElement.pause();
    }
  }

  resumeCurrentMedia() {
    const currentSlide = this.slides.eq(this.currentIndex);
    if (currentSlide.attr('data-media-type') === 'video') {
      this.playVideo(currentSlide);
    }
  }

  // Stop timers without treating this as a manual hover pause
  pauseSlideshowTimers() {
    if (this.autoSlideTimeout) {
      clearTimeout(this.autoSlideTimeout);
      this.autoSlideTimeout = null;
    }
    if (this.autoSlideId) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.autoSlideId);
      } else {
        clearTimeout(this.autoSlideId);
      }
      this.autoSlideId = null;
    }
  }
  
  // Helper method to convert effect name to number
  getEffectTypeNumber(effectName) {
    const effects = {
      'fade': 0,
      'slide': 1,
      'zoom': 2,
      'wave': 3,
      'ripple': 4,
      'windowslice': 5,
      'linearblur': 6,
      'morph': 7,
      'dreamy': 8,
      'wind': 9,
      'squarewire': 10,
      'fadeslide': 11
    };
    return effects[effectName] || 0;
  }
  
  // Select random effect from pool
  getRandomImageEffect() {
    if (this.imageEffectPool.length === 0) return 'fade';
    const randomIndex = Math.floor(Math.random() * this.imageEffectPool.length);
    return this.imageEffectPool[randomIndex];
  }
  
  // Select random text transition from pool
  getRandomTextTransition() {
    if (this.textTransitionPool.length === 0) return 'fade';
    const randomIndex = Math.floor(Math.random() * this.textTransitionPool.length);
    return this.textTransitionPool[randomIndex];
  }
  
  // Get current active image effect (handles random selection)
  getCurrentImageEffect() {
    if (this.effectType === 'random') {
      return this.currentImageEffect;
    }
    return this.effectType;
  }
  
  // Get current active text transition (handles random selection)
  getCurrentTextTransition() {
    if (this.textTransition === 'random') {
      return this.currentTextTransition;
    }
    return this.textTransition;
  }
  
  // Mobile detection utility
  isMobileDevice() {
    return window.innerWidth <= 768 || /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  }
  
  // Get proper dimensions for the canvas
  getCanvasDimensions() {
    const isMobile = this.isMobileDevice();
    
    if (isMobile) {
      // On mobile, ensure container is full height and use viewport dimensions
      this.container.css({
        'height': '100vh',
        'min-height': '100vh',
        'width': '100vw',
        'position': 'relative'
      });
      
      return {
        width: window.innerWidth,
        height: window.innerHeight
      };
    } else {
      // On desktop, use container dimensions with fallback to window
      let width = this.container.width();
      let height = this.container.height();
      
      if (!width || !height) {
        width = $(window).width();
        height = $(window).height();
      }
      
      return { width, height };
    }
  }
  
  // Create and show loader
  createLoader() {
    this.loader = $(`
      <div class="slideshow-loader">
        <div class="brand-text">${this.brandName}</div>
      </div>
    `);
    this.container.append(this.loader);
  }
  
  // Hide loader with smooth transition
  hideLoader() {
    if (this.loader) {
      // Clear the fallback timeout
      if (this.loaderTimeout) {
        clearTimeout(this.loaderTimeout);
        this.loaderTimeout = null;
      }
      
      this.loader.addClass('hide');
      // Remove from DOM after transition completes
      setTimeout(() => {
        if (this.loader) {
          this.loader.remove();
          this.loader = null;
        }
      }, 500);
    }
  }

  // Create global overlay that sits above the canvas
  createGlobalOverlay() {
    this.globalOverlay = $('<div class="slideshow-global-overlay"><div class="slide-content"><h2 class="slide-title"></h2><a href="#" class="slide-btn"></a></div></div>');
    this.container.append(this.globalOverlay);
    // Hide per-slide overlays so captions are not rendered twice (esp. mobile / no WebGL cover)
    this.container.find('.slide-overlay').attr('aria-hidden', 'true');
  }
  
  // Update overlay content based on current slide
  updateOverlayContent() {
    if (!this.globalOverlay) return;
    
    const currentSlide = this.slides.eq(this.currentIndex);
    const overlay = currentSlide.find('.slide-overlay');
    
    if (overlay.length > 0) {
      const title = overlay.find('.slide-title').text();
      const buttonText = overlay.find('.slide-btn').text();
      const buttonHref = overlay.find('.slide-btn').attr('href');
      
      // Apply text transition
      this.animateTextTransition(title, buttonText, buttonHref);
    }
  }
  
  // Animate text transitions
  animateTextTransition(title, buttonText, buttonHref) {
    const titleEl = this.globalOverlay.find('.slide-title');
    const buttonEl = this.globalOverlay.find('.slide-btn');
    
    // Clear any existing animations
    titleEl.stop(true, true);
    buttonEl.stop(true, true);
    
    // Select random text transition if in random mode
    if (this.textTransition === 'random') {
      this.currentTextTransition = this.getRandomTextTransition();
    }
    
    const activeTransition = this.getCurrentTextTransition();
    
    switch(activeTransition) {
      case 'typewriter':
        this.typewriterTransition(titleEl, title);
        this.typewriterTransition(buttonEl, buttonText, buttonHref);
        break;
      case 'slideup':
        this.slideUpTransition(titleEl, title);
        this.slideUpTransition(buttonEl, buttonText, buttonHref);
        break;
      case 'slidedown':
        this.slideDownTransition(titleEl, title);
        this.slideDownTransition(buttonEl, buttonText, buttonHref);
        break;
      case 'fade':
      default:
        this.fadeTransition(titleEl, title);
        this.fadeTransition(buttonEl, buttonText, buttonHref);
        break;
    }
  }
  
  // Fade text transition
  fadeTransition(element, text, href = null) {
    element.fadeOut(this.textTransitionDuration / 2, () => {
      element.text(text);
      if (href) element.attr('href', href);
      element.fadeIn(this.textTransitionDuration / 2);
    });
  }
  
  // Typewriter text transition
  typewriterTransition(element, text, href = null) {
    element.fadeOut(this.textTransitionDuration / 4, () => {
      element.text('');
      if (href) element.attr('href', href);
      element.fadeIn(this.textTransitionDuration / 4, () => {
        let i = 0;
        const typeInterval = setInterval(() => {
          element.text(text.substring(0, i + 1));
          i++;
          if (i >= text.length) {
            clearInterval(typeInterval);
          }
        }, this.textTransitionDuration / (text.length * 2));
      });
    });
  }
  
  // Slide up text transition
  slideUpTransition(element, text, href = null) {
    element.animate({
      opacity: 0,
      marginTop: '-20px'
    }, this.textTransitionDuration / 2, 'swing', () => {
      element.text(text);
      if (href) element.attr('href', href);
      element.animate({
        opacity: 1,
        marginTop: '0px'
      }, this.textTransitionDuration / 2, 'swing');
    });
  }
  
  // Slide down text transition
  slideDownTransition(element, text, href = null) {
    element.animate({
      opacity: 0,
      marginTop: '20px'
    }, this.textTransitionDuration / 2, 'swing', () => {
      element.text(text);
      if (href) element.attr('href', href);
      element.animate({
        opacity: 1,
        marginTop: '0px'
      }, this.textTransitionDuration / 2, 'swing');
    });
  }
  
  init() {
    if (this.slides.length === 0) return;

    // WebGL is only for image transition effects — videos use a normal <video> tag
    this.hasImageSlides = this.slides.toArray().some(
      (slide) => $(slide).attr('data-media-type') !== 'video'
    );
    const firstIsVideo = this.slides.eq(0).attr('data-media-type') === 'video';
    
    // Show loader immediately (skip for video-first — poster should show right away)
    if (!firstIsVideo) {
      this.createLoader();
      
      // Fallback: hide loader after 10 seconds regardless
      this.loaderTimeout = setTimeout(() => {
        this.hideLoader();
      }, 10000);
    }

    if (this.hasImageSlides) {
      this.setupWebGL();
      this.setupResizeHandler();
      this.loadImages();
    } else {
      // Video-only slideshow: no canvas, no shaders, no texture loading
      this.canvas = null;
      this.gl = null;
      this.onPriorityImagesLoaded();
    }

    this.setupNavigation();
    this.setupHoverPause();
    this.initVisibilityTracking();
    
    // Play video if first slide is a video
    this.initFirstSlide();
  }
  
  initFirstSlide() {
    const firstSlide = this.slides.eq(0);
    const isVideo = firstSlide.attr('data-media-type') === 'video';
    
    if (isVideo) {
      // Reveal UI immediately so the poster is visible while the video buffers
      this.onPriorityImagesLoaded();

      const videoElement = firstSlide.find('video')[0];
      if (videoElement) {
        videoElement.addEventListener('error', (e) => {
          console.error('Video load error:', e);
        });
        this.playVideo(firstSlide);
      }
    }
  }
  
  setupWebGL() {
    // Create canvas and insert it before the first slide
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'webgl-slideshow-canvas';
    this.canvas.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 5;
      pointer-events: none;
      opacity: 1;
      transition: opacity 0.5s ease;
      display: block;
    `;
    
    this.container.find('.slide-wrapper').prepend(this.canvas);
    
    // Get WebGL context
    this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
    
    if (!this.gl) {
      console.warn('WebGL not supported, falling back to CSS transitions');
      return;
    }
    
    // Set initial canvas size immediately
    this.setInitialCanvasSize();
    
    this.initShaders();
    this.setupGeometry();
  }
  
  setInitialCanvasSize() {
    const dimensions = this.getCanvasDimensions();
    
    // Set canvas size
    this.canvas.width = dimensions.width;
    this.canvas.height = dimensions.height;
    
    // Update canvas CSS size to match
    this.canvas.style.width = dimensions.width + 'px';
    this.canvas.style.height = dimensions.height + 'px';
    
    // Set WebGL viewport
    if (this.gl) {
      this.gl.viewport(0, 0, dimensions.width, dimensions.height);
    }
  }
  
  initShaders() {
    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `;
    
    const fragmentShaderSource = `
      precision mediump float;
      
      uniform sampler2D u_texture1;
      uniform sampler2D u_texture2;
      uniform float u_progress;
      uniform float u_time;
      uniform vec2 u_resolution;
      uniform vec2 u_imageAspect1;
      uniform vec2 u_imageAspect2;
      uniform int u_effectType;
      uniform float u_effectIntensity;
      uniform float u_effectSpeed;
      
      varying vec2 v_texCoord;
      
      // Helper function to apply aspect ratio correction
      vec2 correctAspectRatio(vec2 uv, vec2 imageAspect) {
        vec2 canvasAspect = u_resolution;
        vec2 scale = canvasAspect / imageAspect;
        float maxScale = max(scale.x, scale.y);
        vec2 scaledSize = imageAspect * maxScale;
        vec2 offset = (canvasAspect - scaledSize) * 0.5 / canvasAspect;
        
        return (uv - 0.5) * (canvasAspect / scaledSize) + 0.5;
      }
      
      // Effect 1: Fade
      vec4 fadeEffect(vec2 uv, float progress) {
        vec2 uv1 = correctAspectRatio(uv, u_imageAspect1);
        vec2 uv2 = correctAspectRatio(uv, u_imageAspect2);
        
        vec4 color1 = texture2D(u_texture1, uv1);
        vec4 color2 = texture2D(u_texture2, uv2);
        
        float smoothProgress = smoothstep(0.0, 1.0, progress);
        return mix(color1, color2, smoothProgress);
      }
      
      // Effect 2: Slide
      vec4 slideEffect(vec2 uv, float progress) {
        float slideOffset = progress;
        
        // Current image slides in from right, previous slides out to left
        vec2 uv1 = correctAspectRatio(uv - vec2(slideOffset, 0.0), u_imageAspect1);
        vec2 uv2 = correctAspectRatio(uv + vec2(1.0 - slideOffset, 0.0), u_imageAspect2);
        
        vec4 color1 = texture2D(u_texture1, uv1);
        vec4 color2 = texture2D(u_texture2, uv2);
        
        // Blend based on which part of the slide we're in
        if (uv.x < slideOffset) {
          return color2; // Show new image on left side
        } else {
          return color1; // Show old image on right side
        }
      }
      
      // Effect 3: Zoom
      vec4 zoomEffect(vec2 uv, float progress) {
        // Reduced zoom intensity for smoother effect
        float zoomIntensity = u_effectIntensity * 0.3; // Reduced from full intensity
        float zoom1 = 1.0 + progress * zoomIntensity;
        float zoom2 = 1.0 + (1.0 - progress) * zoomIntensity;
        
        vec2 center = vec2(0.5);
        vec2 uv1 = correctAspectRatio((uv - center) / zoom1 + center, u_imageAspect1);
        vec2 uv2 = correctAspectRatio((uv - center) / zoom2 + center, u_imageAspect2);
        
        vec4 color1 = texture2D(u_texture1, uv1);
        vec4 color2 = texture2D(u_texture2, uv2);
        
        float smoothProgress = smoothstep(0.0, 1.0, progress);
        return mix(color1, color2, smoothProgress);
      }
      
      // Effect 4: Wave
      vec4 waveEffect(vec2 uv, float progress) {
        // Smooth wave that reduces to zero at the end to prevent jumping
        float waveIntensity = sin(progress * 3.14159) * u_effectIntensity;
        float wave = sin(uv.y * 10.0 + u_time * u_effectSpeed) * 0.02 * waveIntensity;
        
        vec2 uv1 = correctAspectRatio(uv + vec2(wave, 0.0), u_imageAspect1);
        vec2 uv2 = correctAspectRatio(uv - vec2(wave, 0.0), u_imageAspect2);
        
        vec4 color1 = texture2D(u_texture1, uv1);
        vec4 color2 = texture2D(u_texture2, uv2);
        
        float smoothProgress = smoothstep(0.0, 1.0, progress);
        return mix(color1, color2, smoothProgress);
      }
      
      // Effect 5: Ripple
      vec4 rippleEffect(vec2 uv, float progress) {
        vec2 center = vec2(0.5);
        float dist = distance(uv, center);
        
        // Smooth ripple that reduces to zero at the end to prevent jumping
        float rippleIntensity = sin(progress * 3.14159) * u_effectIntensity;
        float ripple = sin(dist * 20.0 - u_time * u_effectSpeed) * 0.01 * rippleIntensity;
        
        vec2 uv1 = correctAspectRatio(uv + vec2(ripple), u_imageAspect1);
        vec2 uv2 = correctAspectRatio(uv - vec2(ripple), u_imageAspect2);
        
        vec4 color1 = texture2D(u_texture1, uv1);
        vec4 color2 = texture2D(u_texture2, uv2);
        
        float smoothProgress = smoothstep(0.0, 1.0, progress);
        return mix(color1, color2, smoothProgress);
      }
      
      // Effect 6: Window Slice
      vec4 windowSliceEffect(vec2 uv, float progress) {
        float sliceWidth = 0.1 * u_effectIntensity;
        float slicePos = progress;
        
        vec2 uv1 = correctAspectRatio(uv, u_imageAspect1);
        vec2 uv2 = correctAspectRatio(uv, u_imageAspect2);
        
        vec4 color1 = texture2D(u_texture1, uv1);
        vec4 color2 = texture2D(u_texture2, uv2);
        
        // Create window slices
        float slice = mod(uv.x * 10.0, 1.0);
        if (slice < slicePos) {
          return color2;
        } else {
          return color1;
        }
      }
      
      // Effect 7: Linear Blur
      vec4 linearBlurEffect(vec2 uv, float progress) {
        vec2 uv1 = correctAspectRatio(uv, u_imageAspect1);
        vec2 uv2 = correctAspectRatio(uv, u_imageAspect2);
        
        // Blur the outgoing image
        vec4 color1 = vec4(0.0);
        float blurAmount = progress * 0.02 * u_effectIntensity;
        for(float i = -2.0; i <= 2.0; i++) {
          for(float j = -2.0; j <= 2.0; j++) {
            color1 += texture2D(u_texture1, uv1 + vec2(i, j) * blurAmount) / 25.0;
          }
        }
        
        vec4 color2 = texture2D(u_texture2, uv2);
        
        float smoothProgress = smoothstep(0.0, 1.0, progress);
        return mix(color1, color2, smoothProgress);
      }
      
      // Effect 8: Morph
      vec4 morphEffect(vec2 uv, float progress) {
        float morphStrength = sin(progress * 3.14159) * u_effectIntensity;
        vec2 center = vec2(0.5);
        vec2 direction = normalize(uv - center);
        float dist = distance(uv, center);
        
        vec2 morphOffset = direction * morphStrength * 0.1 * sin(dist * 10.0 + u_time * u_effectSpeed);
        
        vec2 uv1 = correctAspectRatio(uv + morphOffset, u_imageAspect1);
        vec2 uv2 = correctAspectRatio(uv - morphOffset, u_imageAspect2);
        
        vec4 color1 = texture2D(u_texture1, uv1);
        vec4 color2 = texture2D(u_texture2, uv2);
        
        float smoothProgress = smoothstep(0.0, 1.0, progress);
        return mix(color1, color2, smoothProgress);
      }
      
      // Effect 9: Dreamy
      vec4 dreamyEffect(vec2 uv, float progress) {
        vec2 uv1 = correctAspectRatio(uv, u_imageAspect1);
        vec2 uv2 = correctAspectRatio(uv, u_imageAspect2);
        
        // Add dreamy glow and soft distortion
        float dreamyIntensity = sin(progress * 3.14159) * u_effectIntensity;
        vec2 dreamOffset = vec2(
          sin(uv.y * 5.0 + u_time * u_effectSpeed) * 0.01 * dreamyIntensity,
          cos(uv.x * 5.0 + u_time * u_effectSpeed) * 0.01 * dreamyIntensity
        );
        
        vec4 color1 = texture2D(u_texture1, uv1 + dreamOffset);
        vec4 color2 = texture2D(u_texture2, uv2 - dreamOffset);
        
        // Add soft glow
        float glow = 1.0 + 0.3 * dreamyIntensity;
        color1.rgb *= glow;
        color2.rgb *= glow;
        
        float smoothProgress = smoothstep(0.0, 1.0, progress);
        return mix(color1, color2, smoothProgress);
      }
      
      // Effect 10: Wind
      vec4 windEffect(vec2 uv, float progress) {
        // Smooth wind that reduces to zero at the end to prevent jumping
        float windIntensity = sin(progress * 3.14159) * u_effectIntensity;
        vec2 windDir = vec2(windIntensity * 0.1, sin(uv.y * 8.0 + u_time * u_effectSpeed) * 0.02 * windIntensity);
        
        vec2 uv1 = correctAspectRatio(uv + windDir, u_imageAspect1);
        vec2 uv2 = correctAspectRatio(uv - windDir * 0.5, u_imageAspect2);
        
        vec4 color1 = texture2D(u_texture1, uv1);
        vec4 color2 = texture2D(u_texture2, uv2);
        
        float smoothProgress = smoothstep(0.0, 1.0, progress);
        return mix(color1, color2, smoothProgress);
      }
      
      // Effect 11: Square Wire
      vec4 squareWireEffect(vec2 uv, float progress) {
        vec2 gridUV = uv * 10.0 * u_effectIntensity;
        vec2 gridID = floor(gridUV);
        vec2 gridFract = fract(gridUV);
        
        float wireThickness = 0.1;
        bool isWire = gridFract.x < wireThickness || gridFract.y < wireThickness || 
                      gridFract.x > (1.0 - wireThickness) || gridFract.y > (1.0 - wireThickness);
        
        vec2 uv1 = correctAspectRatio(uv, u_imageAspect1);
        vec2 uv2 = correctAspectRatio(uv, u_imageAspect2);
        
        vec4 color1 = texture2D(u_texture1, uv1);
        vec4 color2 = texture2D(u_texture2, uv2);
        
        if (isWire && progress > mod(gridID.x + gridID.y, 1.0)) {
          return color2;
        } else {
          return color1;
        }
      }
      
      // Effect 12: Fade-Slide
      vec4 fadeSlideEffect(vec2 uv, float progress) {
        // Combine fade and slide effects with reduced intensity
        float slideIntensity = u_effectIntensity * 0.15; // Reduced from 0.3
        float slideOffset = progress * slideIntensity;
        
        vec2 uv1 = correctAspectRatio(uv - vec2(slideOffset, 0.0), u_imageAspect1);
        vec2 uv2 = correctAspectRatio(uv + vec2(slideIntensity - slideOffset, 0.0), u_imageAspect2);
        
        vec4 color1 = texture2D(u_texture1, uv1);
        vec4 color2 = texture2D(u_texture2, uv2);
        
        // Apply fade
        color1.a *= (1.0 - progress);
        color2.a *= progress;
        
        float smoothProgress = smoothstep(0.0, 1.0, progress);
        return mix(color1, color2, smoothProgress);
      }
      
      void main() {
        vec2 uv = v_texCoord;
        vec4 color;
        
        if (u_effectType == 0) {
          color = fadeEffect(uv, u_progress);
        } else if (u_effectType == 1) {
          color = slideEffect(uv, u_progress);
        } else if (u_effectType == 2) {
          color = zoomEffect(uv, u_progress);
        } else if (u_effectType == 3) {
          color = waveEffect(uv, u_progress);
        } else if (u_effectType == 4) {
          color = rippleEffect(uv, u_progress);
        } else if (u_effectType == 5) {
          color = windowSliceEffect(uv, u_progress);
        } else if (u_effectType == 6) {
          color = linearBlurEffect(uv, u_progress);
        } else if (u_effectType == 7) {
          color = morphEffect(uv, u_progress);
        } else if (u_effectType == 8) {
          color = dreamyEffect(uv, u_progress);
        } else if (u_effectType == 9) {
          color = windEffect(uv, u_progress);
        } else if (u_effectType == 10) {
          color = squareWireEffect(uv, u_progress);
        } else if (u_effectType == 11) {
          color = fadeSlideEffect(uv, u_progress);
        } else {
          color = fadeEffect(uv, u_progress);
        }
        
        // Add subtle brightness during transition
        float brightness = 1.0 + 0.05 * sin(u_progress * 3.14159);
        color.rgb *= brightness;
        
        gl_FragColor = color;
      }
    `;
    
    // Create and compile shaders
    const vertexShader = this.createShader(this.gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = this.createShader(this.gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    // Create program
    this.program = this.gl.createProgram();
    this.gl.attachShader(this.program, vertexShader);
    this.gl.attachShader(this.program, fragmentShader);
    this.gl.linkProgram(this.program);
    
    if (!this.gl.getProgramParameter(this.program, this.gl.LINK_STATUS)) {
      console.error('Unable to initialize shader program:', this.gl.getProgramInfoLog(this.program));
      return;
    }
    
    // Get uniform and attribute locations
    this.uniforms = {
      texture1: this.gl.getUniformLocation(this.program, 'u_texture1'),
      texture2: this.gl.getUniformLocation(this.program, 'u_texture2'),
      progress: this.gl.getUniformLocation(this.program, 'u_progress'),
      time: this.gl.getUniformLocation(this.program, 'u_time'),
      resolution: this.gl.getUniformLocation(this.program, 'u_resolution'),
      imageAspect1: this.gl.getUniformLocation(this.program, 'u_imageAspect1'),
      imageAspect2: this.gl.getUniformLocation(this.program, 'u_imageAspect2'),
      effectType: this.gl.getUniformLocation(this.program, 'u_effectType'),
      effectIntensity: this.gl.getUniformLocation(this.program, 'u_effectIntensity'),
      effectSpeed: this.gl.getUniformLocation(this.program, 'u_effectSpeed')
    };
    
    this.attributes = {
      position: this.gl.getAttribLocation(this.program, 'a_position'),
      texCoord: this.gl.getAttribLocation(this.program, 'a_texCoord')
    };
  }
  
  createShader(type, source) {
    const shader = this.gl.createShader(type);
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);
    
    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      console.error('Error compiling shader:', this.gl.getShaderInfoLog(shader));
      this.gl.deleteShader(shader);
      return null;
    }
    
    return shader;
  }
  
  setupGeometry() {
    // Create quad vertices
    const vertices = new Float32Array([
      -1, -1, 0, 1,
       1, -1, 1, 1,
      -1,  1, 0, 0,
       1,  1, 1, 0
    ]);
    
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, vertices, this.gl.STATIC_DRAW);
    
    // Setup attributes
    this.gl.enableVertexAttribArray(this.attributes.position);
    this.gl.enableVertexAttribArray(this.attributes.texCoord);
    
    this.gl.vertexAttribPointer(this.attributes.position, 2, this.gl.FLOAT, false, 16, 0);
    this.gl.vertexAttribPointer(this.attributes.texCoord, 2, this.gl.FLOAT, false, 16, 8);
  }
  
  loadImages() {
    this.totalImages = this.slides.length;
    this.textures = new Array(this.totalImages);
    this.imageDimensions = new Array(this.totalImages);
    this.imagesLoadingQueue = [];
    this.priorityImagesLoaded = 0;
    this.lazyLoadInProgress = false;
    
    // First, load only the first slide (priority) - skip if video
    if (this.slides.length > 0) {
      const firstSlide = this.slides.eq(0);
      const isVideo = firstSlide.attr('data-media-type') === 'video';
      
      if (!isVideo) {
        const firstImg = firstSlide.find('.slide-img')[0];
        if (firstImg && firstImg.src) {
          this.loadTexture(firstImg.src, 0, true); // true indicates priority loading
        }
      } else {
        // For video slides, mark as loaded to avoid WebGL processing
        this.imagesLoaded++;
        console.log('Slide 0 is a video, skipping WebGL texture loading');
        // Do not wait for video data — reveal poster/video immediately
        this.onPriorityImagesLoaded();
      }
    }
    
    // Queue remaining images for lazy loading (skip video slides)
    this.slides.each((index, slide) => {
      if (index === 0) return; // Skip first slide as it's already handled
      
      const $slide = $(slide);
      const isVideo = $slide.attr('data-media-type') === 'video';
      
      if (isVideo) {
        // Video slides don't need WebGL textures
        console.log(`Slide ${index} is a video, skipping WebGL texture loading`);
        return;
      }
      
      const img = $slide.find('.slide-img')[0];
      if (img && img.src) {
        this.imagesLoadingQueue.push({ src: img.src, index: index });
      }
    });
  }
  
  loadTexture(imageSrc, index, isPriority = false) {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    
    image.onload = () => {
      if (!this.gl) return;
      
      // Store image dimensions for aspect ratio calculation
      this.imageDimensions[index] = {
        width: image.width,
        height: image.height,
        aspectRatio: image.width / image.height
      };
      
      const texture = this.gl.createTexture();
      this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
      
      // Upload image data
      this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, image);
      
      // Set texture parameters
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.LINEAR);
      this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.LINEAR);
      
      this.textures[index] = texture;
      this.imagesLoaded++;
      
      if (isPriority) {
        this.priorityImagesLoaded++;
        console.log(`🚀 Priority image ${index} loaded, starting slideshow`);
        this.onPriorityImagesLoaded();
        // Start lazy loading other images after priority image is loaded
        this.startLazyLoading();
      } else {
        console.log(`⏳ Lazy loaded image ${index}`);
      }
    };
    
    image.onerror = () => {
      console.error('Failed to load image:', imageSrc);
      this.imagesLoaded++;
      if (isPriority) {
        this.priorityImagesLoaded++;
        this.onPriorityImagesLoaded();
        this.startLazyLoading();
      }
    };
    
    image.src = imageSrc;
  }
  
  onPriorityImagesLoaded() {
    if (this.initialDisplayReady) return;
    this.initialDisplayReady = true;

    // Initialize slideshow with just the first image loaded
    // Initialize first slide exactly as original
    this.slides.removeClass('active exiting preparing');
    this.slides.eq(0).addClass('active');
    
    // Hide HTML images when using WebGL canvas for image slides
    if (this.hasImageSlides) {
      this.slides.find('.slide-img').css('opacity', '0');
    }
    
    // Create global overlay for slide content
    this.createGlobalOverlay();
    
    // Handle canvas visibility based on first slide type
    const firstSlide = this.slides.eq(0);
    const isFirstVideo = firstSlide.attr('data-media-type') === 'video';
    
    if (this.canvas) {
      if (isFirstVideo) {
        // First slide is video - hide WebGL canvas
        this.canvas.style.display = 'none';
      } else {
        // First slide is image - show WebGL canvas
        this.canvas.style.display = 'block';
        this.canvas.style.opacity = '1';
      }
    }
    
    // Update overlay with current slide content
    this.updateOverlayContent();
    
    // Hide loader now that first image is ready
    this.hideLoader();
    
    // Start auto-slide with same timing as original (but it will only work with loaded images)
    this.startAutoSlide();
    
    // Start WebGL render loop only when image effects are needed
    if (this.hasImageSlides && this.gl) {
      this.render();
    }
  }
  
  startLazyLoading() {
    if (this.lazyLoadInProgress || this.imagesLoadingQueue.length === 0) return;
    
    this.lazyLoadInProgress = true;
    console.log(`📦 Starting smart lazy loading for ${this.imagesLoadingQueue.length} remaining images`);
    
    // Prioritize loading next 2 images first for smoother auto-advance
    this.prioritizeNextImages();
    
    // Load remaining images with a small delay between each to avoid overwhelming the browser
    this.loadNextImageInQueue();
  }
  
  prioritizeNextImages() {
    // Load next 2 images immediately for smoother transitions
    const nextImageIndexes = [1, 2]; // Load slides 1 and 2 first
    
    nextImageIndexes.forEach(index => {
      if (index < this.slides.length) {
        const queueIndex = this.imagesLoadingQueue.findIndex(item => item.index === index);
        if (queueIndex !== -1) {
          const imageData = this.imagesLoadingQueue.splice(queueIndex, 1)[0];
          console.log(`⚡ Priority loading next image ${index}`);
          this.loadTexture(imageData.src, imageData.index, false);
        }
      }
    });
  }
  
  prioritizeImageLoad(targetIndex) {
    // Find the image in the queue and move it to priority loading
    const queueIndex = this.imagesLoadingQueue.findIndex(item => item.index === targetIndex);
    if (queueIndex !== -1) {
      const imageData = this.imagesLoadingQueue.splice(queueIndex, 1)[0];
      console.log(`🔥 Prioritizing load for image ${targetIndex}`);
      this.loadTexture(imageData.src, imageData.index, false);
    }
  }

  loadNextImageInQueue() {
    if (this.imagesLoadingQueue.length === 0) {
      this.lazyLoadInProgress = false;
      console.log('✅ All images lazy loaded successfully');
      return;
    }
    
    const imageData = this.imagesLoadingQueue.shift();
    this.loadTexture(imageData.src, imageData.index, false);
    
    // Schedule next image load with a small delay to prevent browser blocking
    setTimeout(() => {
      this.loadNextImageInQueue();
    }, 100); // 100ms delay between images
  }

  onAllImagesLoaded() {
    // This method is now mostly unused since we use onPriorityImagesLoaded
    // But keeping it for compatibility
    console.log('🎉 All slideshow images have been loaded');
  }
  
  render() {
    if (!this.gl || !this.program) return;
    
    const currentTime = Date.now() * 0.001; // Convert to seconds
    
    this.gl.useProgram(this.program);
    this.gl.clearColor(0, 0, 0, 1);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT);
    
    // Update transition progress
    if (this.isTransitioning && this.transitionStartTime > 0) {
      const elapsed = currentTime - this.transitionStartTime;
      this.transitionProgress = Math.min(elapsed / (this.slideDuration / 1000), 1.0);
      
      if (this.transitionProgress >= 1.0) {
        this.isTransitioning = false;
      }
    }
    
    // Check if current slide is an image (not video)
    const currentSlide = this.slides.eq(this.currentIndex);
    const isCurrentVideo = currentSlide.attr('data-media-type') === 'video';
    
    // Only render if current slide is an image
    if (!isCurrentVideo && this.textures[this.currentIndex]) {
      // Render transition or static slide
      if (this.isTransitioning && this.textures[this.previousIndex]) {
        // Transitioning between two image slides
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[this.previousIndex]);
        this.gl.uniform1i(this.uniforms.texture1, 0);
        
        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[this.currentIndex]);
        this.gl.uniform1i(this.uniforms.texture2, 1);
        
        // Set aspect ratios
        const prevDim = this.imageDimensions[this.previousIndex];
        const currDim = this.imageDimensions[this.currentIndex];
        if (prevDim && currDim) {
          this.gl.uniform2f(this.uniforms.imageAspect1, prevDim.width, prevDim.height);
          this.gl.uniform2f(this.uniforms.imageAspect2, currDim.width, currDim.height);
        }
        
        // Set effect parameters
        this.gl.uniform1i(this.uniforms.effectType, this.getEffectTypeNumber(this.getCurrentImageEffect()));
        this.gl.uniform1f(this.uniforms.effectIntensity, this.effectIntensity);
        this.gl.uniform1f(this.uniforms.effectSpeed, this.effectSpeed);
        
        this.gl.uniform1f(this.uniforms.progress, this.transitionProgress);
        this.gl.uniform1f(this.uniforms.time, currentTime);
        this.gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
        
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
      } else {
        // Display current image slide only (no transition)
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[this.currentIndex]);
        this.gl.uniform1i(this.uniforms.texture1, 0);
        
        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.textures[this.currentIndex]);
        this.gl.uniform1i(this.uniforms.texture2, 1);
        
        // Set aspect ratio for current image
        const currDim = this.imageDimensions[this.currentIndex];
        if (currDim) {
          this.gl.uniform2f(this.uniforms.imageAspect1, currDim.width, currDim.height);
          this.gl.uniform2f(this.uniforms.imageAspect2, currDim.width, currDim.height);
        }
        
        // Set effect parameters (though not transitioning)
        this.gl.uniform1i(this.uniforms.effectType, 0); // Use fade effect for static display
        this.gl.uniform1f(this.uniforms.effectIntensity, this.effectIntensity);
        this.gl.uniform1f(this.uniforms.effectSpeed, this.effectSpeed);
        
        this.gl.uniform1f(this.uniforms.progress, 1.0); // Show texture2 (current slide)
        this.gl.uniform1f(this.uniforms.time, currentTime);
        this.gl.uniform2f(this.uniforms.resolution, this.canvas.width, this.canvas.height);
        
        this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
      }
    }
    
    requestAnimationFrame(() => this.render());
  }
  
  setupNavigation() {
    const self = this;
    
    $('#slideNext').on('click', function() {
      self.next();
    });
    
    $('#slidePrev').on('click', function() {
      self.previous();
    });
  }
  
  setupHoverPause() {
    const self = this;
    
    this.container.on('mouseenter', function() {
      self.pause();
    });
    
    this.container.on('mouseleave', function() {
      self.resume();
    });
  }
  
  setupResizeHandler() {
    // Debounced resize handler for better performance
    let resizeTimeout;
    const handleResize = () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        this.resizeCanvas();
      }, 16); // ~60fps debounce
    };
    
    // Add resize event listener
    $(window).on('resize', handleResize);
    
    // Add mobile-specific event listeners
    window.addEventListener('orientationchange', () => {
      // Delay to allow the browser to settle after orientation change
      setTimeout(() => {
        this.resizeCanvas();
      }, 200);
    });
    
    // Listen for viewport changes (mobile browser address bar show/hide)
    let viewportHeight = window.innerHeight;
    window.addEventListener('scroll', () => {
      if (Math.abs(window.innerHeight - viewportHeight) > 100) {
        viewportHeight = window.innerHeight;
        this.resizeCanvas();
      }
    });
    
    // Store reference for cleanup if needed
    this.resizeHandler = handleResize;
  }
  
  resizeCanvas() {
    if (!this.canvas || !this.gl) return;
    
    const dimensions = this.getCanvasDimensions();
    
    // Update canvas size
    this.canvas.width = dimensions.width;
    this.canvas.height = dimensions.height;
    
    // Update canvas CSS size to match
    this.canvas.style.width = dimensions.width + 'px';
    this.canvas.style.height = dimensions.height + 'px';
    
    // Update WebGL viewport
    this.gl.viewport(0, 0, dimensions.width, dimensions.height);
    
    // Update resolution uniform if we're currently rendering
    if (this.uniforms && this.uniforms.resolution) {
      this.gl.uniform2f(this.uniforms.resolution, dimensions.width, dimensions.height);
    }
  }
  
  next() {
    if (this.isAnimating) return;
    
    const nextIndex = (this.currentIndex + 1) % this.slides.length;
    this.goToSlide(nextIndex);
  }
  
  previous() {
    if (this.isAnimating) return;
    
    const prevIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length;
    this.goToSlide(prevIndex);
  }
  
  goToSlide(targetIndex) {
    if (this.isAnimating || targetIndex === this.currentIndex) return;
    
    // Check if current and target slides are videos
    const currentSlide = this.slides.eq(this.currentIndex);
    const targetSlide = this.slides.eq(targetIndex);
    const isTargetVideo = targetSlide.attr('data-media-type') === 'video';
    const isCurrentVideo = currentSlide.attr('data-media-type') === 'video';
    
    // Pause current video if it's a video
    if (isCurrentVideo) {
      this.pauseVideo(currentSlide);
    }
    
    // Check if target image is loaded, if not prioritize loading it (only for images)
    if (!isTargetVideo && !this.textures[targetIndex]) {
      console.log(`⏳ Image ${targetIndex} not loaded yet, prioritizing load...`);
      this.prioritizeImageLoad(targetIndex);
      // For now, proceed with the transition - WebGL will handle missing textures gracefully
    }
    
    this.isAnimating = true;
    this.previousIndex = this.currentIndex;
    this.currentIndex = targetIndex;
    
    // Select random image effect if in random mode (only for images)
    if (!isTargetVideo && this.effectType === 'random') {
      this.currentImageEffect = this.getRandomImageEffect();
    }
    
    // Log the selected transition type for debugging
    console.log(`🎲 ${isTargetVideo ? '[VIDEO]' : 'Random transition: "' + this.getCurrentImageEffect() + '" | "' + this.getCurrentTextTransition() + '"'}`);
    
    // Handle WebGL transitions and canvas visibility
    if (!isTargetVideo && this.gl && this.textures[this.currentIndex]) {
      // Target is an image slide - show WebGL canvas
      if (this.canvas) {
        this.canvas.style.display = 'block';
        this.canvas.style.opacity = '1';
        console.log('🖼️ Showing WebGL canvas for image slide');
      }
      
      if (!isCurrentVideo && this.textures[this.previousIndex] && this.previousIndex !== undefined) {
        // Image-to-image transition
        this.isTransitioning = true;
        this.transitionStartTime = Date.now() * 0.001;
        this.transitionProgress = 0;
        console.log('🔄 Starting image-to-image WebGL transition');
      } else {
        // Video-to-image transition or first image load
        this.isTransitioning = false;
        this.transitionProgress = 1.0; // Show the image immediately
        console.log('📸 Showing image slide (video-to-image or first load)');
      }
    } else if (isTargetVideo) {
      // Target is a video slide - hide WebGL canvas
      if (this.canvas) {
        this.canvas.style.display = 'none';
        console.log('🎬 Hiding WebGL canvas for video slide');
      }
      this.isTransitioning = false;
    }
    
    // Update overlay content with new slide
    this.updateOverlayContent();
    
    // Handle CSS transitions for all slides (images and videos)
    this.slides.eq(targetIndex).removeClass('preparing').addClass('active');
    
    const previousActive = this.slides.filter('.active').not(this.slides.eq(targetIndex));
    if (previousActive.length > 0) {
      previousActive.removeClass('active').addClass('exiting');
    }
    
    // Play video if target is a video slide
    if (isTargetVideo) {
      console.log(`🎬 Transitioning to video slide ${targetIndex}`);
      this.playVideo(targetSlide);
    }
    
    // Same timing as original
    setTimeout(() => {
      this.slides.filter('.exiting').removeClass('exiting').addClass('preparing');
      this.isAnimating = false;
      this.isTransitioning = false;
      this.resetAutoSlide();
      // Notify about slide change
      this.notifySlideChange();
    }, this.slideDuration);
  }
  
  // Play video in a slide
  playVideo(slide) {
    const videoElement = slide.find('video')[0];
    if (videoElement) {
      // Ensure muted autoplay policies are satisfied
      videoElement.muted = true;
      videoElement.playsInline = true;

      console.log(`🎬 Attempting to play video, readyState: ${videoElement.readyState}`);

      const tryPlay = () => {
        videoElement.play().then(() => {
          console.log('✅ Video started playing successfully');
        }).catch(err => {
          console.warn('❌ Video autoplay failed:', err);
        });
      };

      // Ensure video is ready to play
      if (videoElement.readyState >= 2) { // HAVE_CURRENT_DATA
        tryPlay();
      } else {
        console.log('⏳ Video not ready, waiting for canplay event');
        videoElement.addEventListener('canplay', tryPlay, { once: true });
        videoElement.addEventListener('loadeddata', tryPlay, { once: true });
      }
    } else {
      console.warn('❌ No video element found in slide');
    }
  }
  
  // Pause video in a slide
  pauseVideo(slide) {
    const videoElement = slide.find('video')[0];
    if (videoElement) {
      videoElement.pause();
      videoElement.currentTime = 0; // Reset to beginning
    }
  }
  
  finishTransition() {
    this.slides.not(this.slides.eq(this.currentIndex)).removeClass('exiting').addClass('preparing');
    this.isAnimating = false;
    this.resetAutoSlide();
  }
  
  startAutoSlide() {
    this.resetAutoSlide();
  }
  
  resetAutoSlide() {
    if (this.autoSlideId) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.autoSlideId);
      } else {
        clearTimeout(this.autoSlideId);
      }
    }
    
    this.currentTime = 0;
    this.lastTimestamp = 0;
    this.autoSlideId = this.scheduleNextSlide();
  }
  
  scheduleNextSlide() {
    const self = this;
    
    function autoSlide(timestamp) {
      if (self.isPaused || self.isAnimating) {
        self.autoSlideId = requestAnimationFrame(autoSlide);
        return;
      }
      
      if (!self.lastTimestamp) {
        self.lastTimestamp = timestamp;
      }
      
      const deltaTime = timestamp - self.lastTimestamp;
      self.currentTime += deltaTime;
      self.lastTimestamp = timestamp;
      
      if (self.currentTime >= self.totalDuration) {
        self.next();
        self.currentTime = 0;
      }
      
      self.autoSlideId = requestAnimationFrame(autoSlide);
    }
    
    // Use requestAnimationFrame with fallback - same as original
    if (typeof requestAnimationFrame !== 'undefined') {
      return requestAnimationFrame(autoSlide);
    } else {
      return setInterval(() => {
        self.currentTime += 16;
        if (self.currentTime >= self.totalDuration) {
          self.next();
          self.currentTime = 0;
        }
      }, 16);
    }
  }
  
  pause() {
    this.isPaused = true;
  }
  
  resume() {
    this.isPaused = false;
    this.lastTimestamp = 0;
  }
  
  destroy() {
    if (this.autoSlideId) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(this.autoSlideId);
      } else {
        clearTimeout(this.autoSlideId);
      }
    }
    
    if (this.autoSlideTimeout) {
      clearTimeout(this.autoSlideTimeout);
      this.autoSlideTimeout = null;
    }
    
    // Clean up visibility observers
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect();
      this.intersectionObserver = null;
    }
    
    if (this.visibilityObserver) {
      document.removeEventListener('visibilitychange', this.visibilityObserver);
      this.visibilityObserver = null;
    }
    
    // Clean up WebGL resources
    if (this.gl) {
      this.textures.forEach(texture => {
        if (texture) this.gl.deleteTexture(texture);
      });
      
      if (this.program) {
        this.gl.deleteProgram(this.program);
      }
    }
    
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }

  // Get current slide image URL
  getCurrentSlideImage() {
    if (this.slides && this.slides.length > 0) {
      const currentSlide = this.slides.eq(this.currentIndex);
      const imgElement = currentSlide.find('.slide-img');
      if (imgElement.length > 0) {
        return imgElement.attr('src');
      }
    }
    return null;
  }
  
  // Get current slide data
  getCurrentSlideData() {
    if (this.slides && this.slides.length > 0) {
      const currentSlide = this.slides.eq(this.currentIndex);
      const imgElement = currentSlide.find('.slide-img');
      const titleElement = currentSlide.find('.slide-title');
      
      return {
        image: imgElement.length > 0 ? imgElement.attr('src') : null,
        alt: imgElement.length > 0 ? imgElement.attr('alt') : null,
        title: titleElement.length > 0 ? titleElement.text() : null,
        index: this.currentIndex
      };
    }
    return null;
  }
  
  // Add callback for slide change events
  addSlideChangeCallback(callback) {
    if (!this.slideChangeCallbacks) {
      this.slideChangeCallbacks = [];
    }
    this.slideChangeCallbacks.push(callback);
  }
  
  // Notify slide change callbacks
  notifySlideChange() {
    if (this.slideChangeCallbacks) {
      const slideData = this.getCurrentSlideData();
      this.slideChangeCallbacks.forEach(callback => {
        try {
          callback(slideData);
        } catch (error) {
          console.error('Error in slide change callback:', error);
        }
      });
    }
  }
  
  // Pause slideshow (for performance when out of view)
  pauseSlideshow() {
    this.pauseSlideshowTimers();
    console.log('🚫 Slideshow paused for performance optimization');
  }
  
  // Resume slideshow
  resumeSlideshow() {
    this.resetAutoSlide();
    console.log('▶️ Slideshow resumed');
  }
  
  // Check if slideshow is paused
  isPausedState() {
    return this.isPaused;
  }
}

// Export for global use
window.WebGLSlideshow = WebGLSlideshow;

  // Auto-initialize when DOM is ready (same pattern as original)
$(document).ready(function() {
  // Initialize WebGL slideshow with enhanced effects
  const slideshow = new WebGLSlideshow('#slideshow', {
    slideDuration: 1000,  // 1 second for slide transition
    viewDuration: 5000,   // 5 seconds for viewing
    
    // Brand Configuration
    brandName: window.SLIDESHOW_BRAND_NAME || '', // Can be configured per page or from global config
    
    // Image Effects: 'fade', 'slide', 'zoom', 'wave', 'ripple', 'windowslice', 'linearblur', 'morph', 'dreamy', 'wind', 'squarewire', 'fadeslide', 'random'
    effectType: 'random',   
    effectIntensity: 0.5, // 0.0 to 2.0 - intensity of the effect
    effectSpeed: 2.0,     // 0.5 to 5.0 - speed of animated effects
    
    // Pool of effects for random selection (customize as needed)
    imageEffectPool: ['fade', 'fadeslide'],
    
    // Text Transitions: 'fade', 'typewriter', 'slideup', 'slidedown', 'random'
    textTransition: 'random',  
    textTransitionDuration: 800,    // Duration in milliseconds
    
    // Pool of text transitions for random selection
    textTransitionPool: ['fade', 'typewriter', 'slideup', 'slidedown']
  });
  
  // Store reference globally for potential external control
  window.slideshowInstance = slideshow;
  
           // Initialize scroll arrow functionality
         const scrollArrow = document.getElementById('scrollToNext');
         if (scrollArrow) {
           scrollArrow.addEventListener('click', function() {
             // Scroll to the next section (you can customize this)
             const nextSection = document.querySelector('.about-section') || 
                               document.querySelector('.services-section') || 
                               document.querySelector('.projects-section');
             if (nextSection) {
               nextSection.scrollIntoView({ 
                 behavior: 'smooth',
                 block: 'start'
               });
             }
           });
         }
  
  // To override brandName on a specific page, you can:
  // 1. Set a global variable before this script loads:
  //    window.SLIDESHOW_BRAND_NAME = 'Custom Brand';
  // 2. Or initialize in the page template instead of here
  
  // Example of how to change effects dynamically:
  // window.slideshowInstance.effectType = 'dreamy';
  // window.slideshowInstance.textTransition = 'slideup';
  // window.slideshowInstance.imageEffectPool = ['morph', 'ripple', 'squarewire'];
  // window.slideshowInstance.effectIntensity = 1.5;
});