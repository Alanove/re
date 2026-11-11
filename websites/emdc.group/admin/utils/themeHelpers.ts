import * as path from 'path';
import * as fs from 'fs';
import { DATA_PATHS } from '../../src/constants';

export interface ThemePanelOptions {
  showThemeColors?: boolean;
  showDarkMode?: boolean;
  showCustomSettings?: boolean;
  position?: 'right' | 'left';
  collapsed?: boolean;
}

export class ThemeHelpers {
  /**
   * Get theme panel HTML
   */
  public static getThemePanelHTML(options: ThemePanelOptions = {}): string {
    const defaultOptions: ThemePanelOptions = {
      showThemeColors: true,
      showDarkMode: true,
      showCustomSettings: false,
      position: 'right',
      collapsed: false
    };

    const config = { ...defaultOptions, ...options };
    
    // Read the theme panel partial
    const partialPath = path.join(DATA_PATHS.ADMIN_DIR, 'views/partials/theme-panel.ejs');
    
    try {
      if (fs.existsSync(partialPath)) {
        let html = fs.readFileSync(partialPath, 'utf8');
        
        // Apply options
        if (!config.showThemeColors) {
          html = html.replace(/<!-- BEGIN theme-list -->[\s\S]*?<!-- END theme-list -->/g, '');
        }
        
        if (!config.showDarkMode) {
          html = html.replace(/<div class="row mt-10px">[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/div>/g, '');
        }
        
        if (config.collapsed) {
          html = html.replace(/class="theme-panel"/, 'class="theme-panel collapsed"');
        }
        
        return html;
      }
    } catch (error) {
      console.error('Error reading theme panel partial:', error);
    }
    
    return '';
  }

  /**
   * Get theme panel CSS
   */
  public static getThemePanelCSS(): string {
    return `
      .theme-panel {
        position: fixed;
        top: 0;
        right: -300px;
        width: 300px;
        height: 100vh;
        background: #fff;
        border-left: 1px solid #ddd;
        z-index: 9999;
        transition: right 0.3s ease;
        box-shadow: -2px 0 10px rgba(0,0,0,0.1);
      }
      
      .theme-panel.expanded {
        right: 0;
      }
      
      .theme-collapse-btn {
        position: absolute;
        left: -40px;
        top: 50%;
        transform: translateY(-50%);
        width: 40px;
        height: 40px;
        background: #007bff;
        color: #fff;
        text-align: center;
        line-height: 40px;
        border-radius: 4px 0 0 4px;
        text-decoration: none;
      }
      
      .theme-panel-content {
        padding: 20px;
        height: 100%;
        overflow-y: auto;
      }
      
      .theme-list {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin: 20px 0;
      }
      
      .theme-list-item {
        text-align: center;
      }
      
      .theme-list-link {
        display: block;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        margin: 0 auto;
        text-decoration: none;
        border: 2px solid transparent;
      }
      
      .theme-list-item.active .theme-list-link {
        border-color: #333;
      }
      
      .theme-panel-divider {
        height: 1px;
        background: #ddd;
        margin: 20px 0;
      }
    `;
  }

  /**
   * Get theme panel JavaScript
   */
  public static getThemePanelJS(): string {
    return `
      // Theme panel functionality
      document.addEventListener('DOMContentLoaded', function() {
        // Initialize theme panel
        const themePanel = document.querySelector('.theme-panel');
        const themeCollapseBtn = document.querySelector('[data-toggle="theme-panel-expand"]');
        
        if (themeCollapseBtn) {
          themeCollapseBtn.addEventListener('click', function(e) {
            e.preventDefault();
            if (themePanel) {
              themePanel.classList.toggle('expanded');
            }
          });
        }
        
        // Theme selector
        document.addEventListener('click', function(e) {
          const target = e.target;
          if (target.closest('[data-toggle="theme-selector"]')) {
            e.preventDefault();
            const link = target.closest('[data-toggle="theme-selector"]');
            const themeClass = link.getAttribute('data-theme-class') || 'default';
            
            // Remove active class from all items
            document.querySelectorAll('.theme-list-item').forEach(item => {
              item.classList.remove('active');
            });
            
            // Add active class to clicked item
            const listItem = link.closest('.theme-list-item');
            if (listItem) {
              listItem.classList.add('active');
            }
            
            // Apply theme
            document.body.className = document.body.className.replace(/theme-\\w+/g, '');
            if (themeClass && themeClass !== 'default') {
              document.body.classList.add(themeClass);
            }
            
            // Save to localStorage
            localStorage.setItem('lw-njs-cms-admin-theme', JSON.stringify({
              currentTheme: themeClass,
              darkMode: document.getElementById('appThemeDarkMode')?.checked || false
            }));
          }
        });
        
        // Dark mode toggle
        const darkModeToggle = document.getElementById('appThemeDarkMode');
        if (darkModeToggle) {
          darkModeToggle.addEventListener('change', function() {
            const isDarkMode = this.checked;
            document.body.classList.toggle('theme-dark', isDarkMode);
            document.body.classList.toggle('theme-light', !isDarkMode);
            
            // Save to localStorage
            const currentTheme = localStorage.getItem('lw-njs-cms-admin-theme');
            const themeConfig = currentTheme ? JSON.parse(currentTheme) : { currentTheme: 'default' };
            themeConfig.darkMode = isDarkMode;
            localStorage.setItem('lw-njs-cms-admin-theme', JSON.stringify(themeConfig));
          });
        }
      });
    `;
  }

  /**
   * Load saved theme on page load
   */
  public static loadSavedTheme(): string {
    return `
      // Load saved theme
      document.addEventListener('DOMContentLoaded', function() {
        const savedTheme = localStorage.getItem('lw-njs-cms-admin-theme');
        if (savedTheme) {
          try {
            const themeConfig = JSON.parse(savedTheme);
            
            // Apply theme
            if (themeConfig.currentTheme && themeConfig.currentTheme !== 'default') {
              document.body.classList.add(themeConfig.currentTheme);
            }
            
            // Apply dark mode
            if (themeConfig.darkMode) {
              document.body.classList.add('theme-dark');
              document.body.classList.remove('theme-light');
            } else {
              document.body.classList.add('theme-light');
              document.body.classList.remove('theme-dark');
            }
            
            // Update UI
            const darkModeToggle = document.getElementById('appThemeDarkMode');
            if (darkModeToggle) {
              darkModeToggle.checked = themeConfig.darkMode;
            }
            
            // Update theme selector
            const themeLinks = document.querySelectorAll('[data-toggle="theme-selector"]');
            themeLinks.forEach(link => {
              const themeClass = link.getAttribute('data-theme-class');
              const listItem = link.closest('.theme-list-item');
              
              if (listItem) {
                listItem.classList.remove('active');
                if (themeClass === themeConfig.currentTheme || (!themeClass && themeConfig.currentTheme === 'default')) {
                  listItem.classList.add('active');
                }
              }
            });
          } catch (error) {
            console.error('Error loading saved theme:', error);
          }
        }
      });
    `;
  }
} 