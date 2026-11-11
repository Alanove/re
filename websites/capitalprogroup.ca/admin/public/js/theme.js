// CMS Admin Theme Service - Client Side
(function() {
  'use strict';

  // Theme configuration
  const THEME_CONFIG = {
    storageKey: 'lw-njs-cms-admin-theme',
    defaultTheme: 'default',
    defaultDarkMode: false
  };

  // Available themes
  const AVAILABLE_THEMES = {
    'default': { name: 'Default', class: '', color: 'teal' },
    'theme-red': { name: 'Red', class: 'theme-red', color: 'red' },
    'theme-pink': { name: 'Pink', class: 'theme-pink', color: 'pink' },
    'theme-orange': { name: 'Orange', class: 'theme-orange', color: 'orange' },
    'theme-yellow': { name: 'Yellow', class: 'theme-yellow', color: 'yellow' },
    'theme-lime': { name: 'Lime', class: 'theme-lime', color: 'lime' },
    'theme-green': { name: 'Green', class: 'theme-green', color: 'green' },
    'theme-cyan': { name: 'Cyan', class: 'theme-cyan', color: 'cyan' },
    'theme-blue': { name: 'Blue', class: 'theme-blue', color: 'blue' },
    'theme-purple': { name: 'Purple', class: 'theme-purple', color: 'purple' },
    'theme-indigo': { name: 'Indigo', class: 'theme-indigo', color: 'indigo' },
    'theme-gray-600': { name: 'Black', class: 'theme-gray-600', color: 'black' }
  };

  // Theme Service Class
  class CMSThemeService {
    constructor() {
      this.init();
    }

    /**
     * Initialize theme service
     */
    init() {
      this.loadTheme();
      this.applyTheme();
      this.initEventListeners();
    }

    /**
     * Load theme from localStorage
     */
    loadTheme() {
      try {
        const stored = localStorage.getItem(THEME_CONFIG.storageKey);
        if (stored) {
          return JSON.parse(stored);
        }
      } catch (error) {
        console.error('Error loading theme from localStorage:', error);
      }
      return {
        currentTheme: THEME_CONFIG.defaultTheme,
        darkMode: THEME_CONFIG.defaultDarkMode
      };
    }

    /**
     * Save theme to localStorage
     */
    saveTheme(config) {
      try {
        localStorage.setItem(THEME_CONFIG.storageKey, JSON.stringify(config));
      } catch (error) {
        console.error('Error saving theme to localStorage:', error);
      }
    }

    /**
     * Apply theme to document
     */
    applyTheme() {
      const config = this.loadTheme();
      const body = document.body;

      // Remove all theme classes
      Object.values(AVAILABLE_THEMES).forEach(theme => {
        if (theme.class) {
          body.classList.remove(theme.class);
        }
      });

      // Remove dark mode classes
      body.classList.remove('theme-light', 'theme-dark');

      // Apply current theme
      if (config.currentTheme !== 'default' && AVAILABLE_THEMES[config.currentTheme]) {
        const theme = AVAILABLE_THEMES[config.currentTheme];
        if (theme && theme.class) {
          body.classList.add(theme.class);
        }
      }

      // Apply dark mode
      if (config.darkMode) {
        body.classList.add('theme-dark');
      } else {
        body.classList.add('theme-light');
      }

      // Update UI
      this.updateThemePanelUI(config);
    }

    /**
     * Update theme panel UI
     */
    updateThemePanelUI(config) {
      // Update theme selector
      const themeLinks = document.querySelectorAll('[data-toggle="theme-selector"]');
      themeLinks.forEach(link => {
        const themeClass = link.getAttribute('data-theme-class');
        const listItem = link.closest('.theme-list-item');
        
        if (listItem) {
          listItem.classList.remove('active');
          if (themeClass === config.currentTheme || (!themeClass && config.currentTheme === 'default')) {
            listItem.classList.add('active');
          }
        }
      });

      // Update dark mode toggle
      const darkModeToggle = document.getElementById('appThemeDarkMode');
      if (darkModeToggle) {
        darkModeToggle.checked = config.darkMode;
      }
    }

    /**
     * Set theme
     */
    setTheme(themeName) {
      const config = this.loadTheme();
      config.currentTheme = themeName;
      this.saveTheme(config);
      this.applyTheme();
    }

    /**
     * Set dark mode
     */
    setDarkMode(enabled) {
      const config = this.loadTheme();
      config.darkMode = enabled;
      this.saveTheme(config);
      this.applyTheme();
    }

    /**
     * Toggle dark mode
     */
    toggleDarkMode() {
      const config = this.loadTheme();
      config.darkMode = !config.darkMode;
      this.saveTheme(config);
      this.applyTheme();
      return config.darkMode;
    }

    /**
     * Initialize event listeners
     */
    initEventListeners() {
      // Theme selector clicks
      document.addEventListener('click', (e) => {
        const target = e.target;
        if (target.closest('[data-toggle="theme-selector"]')) {
          e.preventDefault();
          const link = target.closest('[data-toggle="theme-selector"]');
          const themeClass = link.getAttribute('data-theme-class') || 'default';
          this.setTheme(themeClass);
        }
      });

      // Dark mode toggle
      document.addEventListener('change', (e) => {
        const target = e.target;
        if (target.id === 'appThemeDarkMode') {
          this.setDarkMode(target.checked);
        }
      });

      // Theme panel expand/collapse
      document.addEventListener('click', (e) => {
        const target = e.target;
        if (target.closest('[data-toggle="theme-panel-expand"]')) {
          e.preventDefault();
          const panel = document.querySelector('.theme-panel');
          if (panel) {
            panel.classList.toggle('expanded');
          }
        }
      });
    }

    /**
     * Reset theme to default
     */
    resetTheme() {
      const defaultConfig = {
        currentTheme: THEME_CONFIG.defaultTheme,
        darkMode: THEME_CONFIG.defaultDarkMode
      };
      this.saveTheme(defaultConfig);
      this.applyTheme();
    }

    /**
     * Get current theme
     */
    getCurrentTheme() {
      return this.loadTheme();
    }
  }

  // Initialize theme service when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.cmsThemeService = new CMSThemeService();
    });
  } else {
    window.cmsThemeService = new CMSThemeService();
  }

  // Export for global access
  window.CMSThemeService = CMSThemeService;

})(); 