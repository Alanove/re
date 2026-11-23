/**
 * Get CSRF token from meta tag
 * @returns {string} CSRF token
 */
function getCsrfToken() {
  const meta = document.querySelector('meta[name="csrf-token"]');
  return meta ? meta.getAttribute('content') : '';
}

/**
 * Change language function
 * @param {string} lang - Language code to change to
 */
function changeLanguage(lang) {
  // Get CSRF token from meta tag or use global helper function
  const csrfToken = typeof getCsrfToken !== 'undefined' ? getCsrfToken() :
    (document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '');

  const headers = {
    'Content-Type': 'application/json',
  };

  // Add CSRF token to headers if available
  if (csrfToken) {
    headers['X-CSRF-Token'] = csrfToken;
  }

  fetch('/admin/change-language', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ language: lang })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        window.location.reload();
      } else {
        console.error('Error changing language:', data.error || 'Unknown error');
        if (typeof showErrorToast === 'function') {
          showErrorToast('Failed to change language: ' + (data.error || 'Unknown error'));
        }
      }
    })
    .catch(error => {
      console.error('Error changing language:', error);
      if (typeof showErrorToast === 'function') {
        showErrorToast('Failed to change language: ' + error.message);
      }
    });
}

/**
 * Show a generic action modal (e.g. for delete confirmation)
 * @param {Object} options
 *   - title: Modal title
 *   - message: Modal body message
 *   - endpoint: URL to send the AJAX request to
 *   - onSuccess: function to call on successful AJAX
 *   - method: HTTP method (default: DELETE)
 */
function showActionModal({ title, message, endpoint, onSuccess, method = 'DELETE' }) {
  const modal = new bootstrap.Modal(document.getElementById('modal-dialog'));
  document.getElementById('modalDialogTitle').textContent = title;
  document.getElementById('modalDialogBody').textContent = message;
  const actionBtn = document.getElementById('modalDialogActionBtn');
  actionBtn.textContent = title;
  actionBtn.className = 'btn btn-danger';
  const translations = window.translations || {};
  const processingText = translations.processing || 'Processing...';
  const errorText = translations.errorOccurred || 'An error occurred.';

  actionBtn.onclick = function () {
    actionBtn.disabled = true;
    actionBtn.textContent = processingText;
    const headers = { 'Content-Type': 'application/json' };
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers['X-CSRF-Token'] = csrfToken;
    }
    fetch(endpoint, {
      method: method,
      headers: headers,
    })
      .then(res => res.json().then(data => ({ status: res.status, data })))
      .then(({ status, data }) => {
        modal.hide();
        if (typeof onSuccess === 'function') onSuccess(data, status);
      })
      .catch(() => {
        modal.hide();
        showErrorToast(errorText);
      })
      .finally(() => {
        actionBtn.disabled = false;
        actionBtn.textContent = title;
      });
  };
  modal.show();
}

/**
 * Generic delete function for any resource.
 * @param {string} endpoint - The API endpoint to send the DELETE request to.
 * @param {HTMLElement} btn - The button element that triggered the delete.
 * @param {string} [title] - The modal title and action button text (optional, will use translations if not provided).
 * @param {string} [message] - The confirmation message (optional, will use translations if not provided).
 */
function deleteItem(endpoint, btn, title, message) {
  const translations = window.translations || {};

  // Determine resource type from endpoint and use appropriate translations
  let resourceTitle = title;
  let resourceMessage = message;
  let successMessage = translations.itemDeletedSuccess || 'Item deleted successfully';

  if (endpoint.includes('/admin/pages/')) {
    resourceTitle = title || translations.deletePage || translations.delete || 'Delete Page';
    if (!message) {
      if (translations.deletePageConfirm && translations.deletePageWarning) {
        resourceMessage = translations.deletePageConfirm + ' ' + translations.deletePageWarning;
      } else {
        resourceMessage = translations.deletePageConfirm || translations.deleteItemMessage || 'Are you sure you want to delete this page?';
      }
    }
    successMessage = translations.pageDeletedSuccess || 'Page deleted successfully';
  } else if (endpoint.includes('/admin/users/')) {
    resourceTitle = title || translations.deleteUser || translations.delete || 'Delete User';
    if (!message) {
      if (translations.deleteUserConfirm && translations.deleteUserWarning) {
        resourceMessage = translations.deleteUserConfirm + ' ' + translations.deleteUserWarning;
      } else {
        resourceMessage = translations.deleteUserConfirm || translations.deleteItemMessage || 'Are you sure you want to delete this user?';
      }
    }
    successMessage = translations.userDeletedSuccess || 'User deleted successfully';
  } else if (endpoint.includes('/admin/projects/')) {
    resourceTitle = title || translations.delete || 'Delete';
    resourceMessage = message || translations.deleteItemMessage || 'Are you sure you want to delete this item?';
    successMessage = translations.projectDeletedSuccess || 'Project deleted successfully';
  } else if (endpoint.includes('/admin/clients/')) {
    resourceTitle = title || translations.delete || 'Delete';
    resourceMessage = message || translations.deleteItemMessage || 'Are you sure you want to delete this item?';
    successMessage = translations.clientDeletedSuccess || 'Client deleted successfully';
  } else {
    // Default generic delete
    resourceTitle = title || translations.delete || 'Delete';
    resourceMessage = message || translations.deleteItemMessage || 'Are you sure you want to delete this item?';
    successMessage = translations.itemDeletedSuccess || 'Item deleted successfully';
  }

  showActionModal({
    title: resourceTitle,
    message: resourceMessage,
    endpoint: endpoint,
    onSuccess: function (data, status) {
      if (data.success && btn) {
        // Find the closest tr ancestor and remove it
        let row = btn.closest('tr');
        if (row) {
          row.style.transition = 'opacity 0.3s';
          row.style.opacity = '0';
          setTimeout(() => row.remove(), 300);
        }

        // Show success toast
        showSuccessToast(successMessage);
      } else {
        // Show the server's message directly for client errors (4xx), otherwise generic message
        const isClientError = status >= 400 && status < 500;
        const errorMsg = isClientError && data.message
          ? data.message
          : (translations.deleteError || 'Failed to delete item') + ': ' + (data.message || (translations.errorOccurred || 'Unknown error'));
        showErrorToast(errorMsg);
      }
    }
  });
}

/**
 * Show a toast notification
 * @param {Object} options
 *   - message: Toast message content
 *   - type: Toast type ('success', 'error', 'warning', 'info') - defaults to 'info'
 *   - duration: Duration in milliseconds (default: 5000)
 *   - position: Position ('top-right', 'top-left', 'bottom-right', 'bottom-left') - defaults to 'top-right'
 */
function showToast(optionsOrMessage, typeArg = 'info') {
  let message, type, duration, position;

  if (typeof optionsOrMessage === 'object' && optionsOrMessage !== null) {
    ({ message, type = 'info', duration = 5000, position = 'top-right' } = optionsOrMessage);
  } else {
    message = optionsOrMessage;
    type = typeArg;
    duration = 5000;
    position = 'top-right';
  }

  // Create toast container if it doesn't exist
  let toastContainer = document.getElementById('toast-container');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      z-index: 99999;
      pointer-events: none;
      ${position.includes('top') ? 'top: 20px;' : 'bottom: 20px;'}
      ${position.includes('right') ? 'right: 20px;' : 'left: 20px;'}
      width: auto;
      height: auto;
    `;
    document.body.appendChild(toastContainer);
  }

  // Create toast element with simpler styling
  const toast = document.createElement('div');
  toast.className = 'custom-toast';
  toast.style.cssText = `
    background: #ffffff;
    border: 1px solid #ddd;
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    margin-bottom: 10px;
    padding: 12px 16px;
    min-width: 250px;
    max-width: 350px;
    pointer-events: auto;
    border-left: 4px solid;
    display: block !important;
    visibility: visible !important;
    opacity: 1 !important;
    z-index: 100000 !important;
    font-family: Arial, sans-serif;
    font-size: 14px;
    line-height: 1.4;
    color: #333 !important;
  `;

  // Set border color based on type
  const colors = {
    success: '#28a745',
    error: '#dc3545',
    warning: '#ffc107',
    info: '#17a2b8'
  };
  toast.style.borderLeftColor = colors[type] || colors.info;

  // Create simple content
  const icon = type === 'success' ? '✓' : type === 'error' ? '✗' : type === 'warning' ? '⚠' : 'ℹ';
  const iconColor = colors[type] || colors.info;

  toast.innerHTML = `
    <div style="display: flex; align-items: center; justify-content: space-between;">
      <div style="display: flex; align-items: center;">
        <span style="color: ${iconColor}; font-size: 16px; margin-right: 8px; font-weight: bold;">${icon}</span>
        <span style="color: #333; font-size: 14px;">${message}</span>
      </div>
      <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; color: #999; cursor: pointer; font-size: 16px; margin-left: 12px;">×</button>
    </div>
  `;

  // Add to container
  toastContainer.appendChild(toast);

  // Auto remove after duration
  setTimeout(() => {
    if (toast && toast.parentNode) {
      toast.remove();
    }
  }, duration);
}

/**
 * Generic function to copy value from one input to another on change, only if target is empty
 * @param {string} sourceId - The ID of the source input element
 * @param {string} targetId - The ID of the target input element
 * @param {string} prefix - Optional prefix to add to the copied value
 */
function copyInputOnChange(sourceId, targetId, prefix = '') {
  const source = document.getElementById(sourceId);
  const target = document.getElementById(targetId);
  if (!source || !target) return;
  source.addEventListener('change', function () {
    if (target.value === '') {
      target.value = prefix + source.value;
      target.dispatchEvent(new Event('input'));
    }
  });
}

/**
 * Convert title to URL-friendly key with transliteration support
 * Handles Cyrillic, Arabic, and other non-English characters
 * @param {string} title - The title to convert
 * @returns {string} - URL-friendly key
 */
function titleToKey(title) {
  if (!title) return '';

  let slug = title.toLowerCase().trim();

  // Transliteration map for Cyrillic characters (Russian)
  const cyrillicMap = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo',
    'ж': 'zh', 'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm',
    'н': 'n', 'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u',
    'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
    'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya'
  };

  // Transliteration map for Arabic characters
  const arabicMap = {
    'ا': 'a', 'أ': 'a', 'إ': 'i', 'آ': 'aa', 'ب': 'b', 'ت': 't', 'ث': 'th',
    'ج': 'j', 'ح': 'h', 'خ': 'kh', 'د': 'd', 'ذ': 'th', 'ر': 'r', 'ز': 'z',
    'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd', 'ط': 't', 'ظ': 'z', 'ع': 'a',
    'غ': 'gh', 'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l', 'م': 'm', 'ن': 'n',
    'ه': 'h', 'و': 'w', 'ي': 'y', 'ى': 'a', 'ة': 'h', 'ئ': 'y', 'ء': 'a'
  };

  // Common accented characters (French, Spanish, German, etc.)
  const accentMap = {
    'à': 'a', 'á': 'a', 'â': 'a', 'ã': 'a', 'ä': 'a', 'å': 'a',
    'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
    'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i',
    'ò': 'o', 'ó': 'o', 'ô': 'o', 'õ': 'o', 'ö': 'o',
    'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u',
    'ý': 'y', 'ÿ': 'y',
    'ç': 'c', 'ñ': 'n',
    'ß': 'ss', 'æ': 'ae', 'œ': 'oe'
  };

  // Combine all transliteration maps
  const transliterationMap = { ...cyrillicMap, ...arabicMap, ...accentMap };

  // Transliterate characters
  slug = slug.split('').map(char => {
    // Check if character exists in transliteration map
    if (transliterationMap[char]) {
      return transliterationMap[char];
    }
    // Keep the character if it's already ASCII alphanumeric, space, or hyphen
    return char;
  }).join('');

  // Remove HTML file extension if present
  slug = slug.replace(/\.html?$/i, '');

  // Replace spaces and special characters with hyphens (keep only alphanumeric and hyphens)
  slug = slug.replace(/[^a-z0-9-]/gi, '-');

  // Replace multiple consecutive hyphens with single hyphen
  slug = slug.replace(/-+/g, '-');

  // Remove leading and trailing hyphens
  slug = slug.replace(/^-+|-+$/g, '');

  // Limit length to 500 characters (database limit)
  if (slug.length > 500) {
    slug = slug.substring(0, 500);
    slug = slug.replace(/-+$/, ''); // Remove trailing hyphen if truncated
  }

  return slug || 'page';
}

/**
 * Convert title to URL
 * @param {string} title - The title to convert
 * @returns {string} - URL with leading slash
 */
function titleToUrl(title) {
  return '/' + titleToKey(title);
}

/**
 * Extract description from HTML content
 * @param {string} content - HTML content
 * @param {number} maxLength - Maximum length for description (default: 160)
 * @returns {string} - Plain text description
 */
function extractDescription(content, maxLength = 160) {
  if (!content) return '';

  // Remove HTML tags and get plain text
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = content;
  const plainText = tempDiv.textContent || tempDiv.innerText || '';

  // Take first maxLength characters and add ellipsis if longer
  return plainText.length > maxLength ? plainText.substring(0, maxLength - 3) + '...' : plainText;
}

/**
 * Auto-generate SEO description from Quill editor content
 * @param {string} targetId - ID of the description input field
 */
function autoGenerateDescription(targetId) {
  const quillEditor = document.querySelector('#quill-editor');
  const descriptionInput = document.getElementById(targetId);

  if (!quillEditor || !descriptionInput) return;

  const quillInstance = quillEditor.__quill;
  if (quillInstance) {
    const content = quillInstance.root.innerHTML;
    const description = extractDescription(content);

    // Only update if description field is empty or hasn't been manually edited
    if (description && (descriptionInput.value === '' || descriptionInput.dataset.autoGenerated === 'true')) {
      descriptionInput.value = description;
      descriptionInput.dataset.autoGenerated = 'true';
      descriptionInput.dispatchEvent(new Event('input'));
    }
  }
}

/**
 * Helper functions for common toast types
 */
function showSuccessToast(message, duration = 3000) {
  showToast({ message, type: 'success', duration });
}

function showErrorToast(message, duration = 5000) {
  showToast({ message, type: 'error', duration });
}

function showWarningToast(message, duration = 4000) {
  showToast({ message, type: 'warning', duration });
}

function showInfoToast(message, duration = 4000) {
  showToast({ message, type: 'info', duration });
}

/**
 * Language switcher functionality
 */
document.addEventListener('DOMContentLoaded', function () {
  // Handle language dropdown clicks using event delegation
  const languageDropdown = document.getElementById('language-dropdown');
  if (languageDropdown) {
    languageDropdown.addEventListener('click', function (e) {
      const languageOption = e.target.closest('.language-option');
      if (languageOption) {
        e.preventDefault();
        const lang = languageOption.getAttribute('data-language');
        if (lang) {
          changeLanguage(lang);
        }
      }
    });
  }
});

/**
 * Dashboard specific functionality
 */
document.addEventListener('DOMContentLoaded', function () {
  // Dashboard stats cards - no animation
  const statsCards = document.querySelectorAll('.dashboard-stats-card');
  // Cards are already visible, no animation needed

  // Quick action buttons hover effect - removed translate effects
  const quickActionBtns = document.querySelectorAll('.quick-actions-panel .btn');
  quickActionBtns.forEach(btn => {
    btn.addEventListener('mouseenter', function () {
      // Only add shadow effect, no movement
    });

    btn.addEventListener('mouseleave', function () {
      // Reset any effects
    });
  });

  // Recent items table row hover effects - removed translate effects
  const tableRows = document.querySelectorAll('.recent-items-table tbody tr');
  tableRows.forEach(row => {
    row.addEventListener('mouseenter', function () {
      this.style.backgroundColor = 'rgba(0, 123, 255, 0.05)';
      this.style.transition = 'background-color 0.2s ease';
    });

    row.addEventListener('mouseleave', function () {
      this.style.backgroundColor = '';
    });
  });

  // Auto-refresh CMS dashboard data every 5 minutes (only on CMS dashboard)
  let refreshInterval;
  if (window.location.pathname === '/admin/dashboard/cms') {
    refreshInterval = setInterval(() => {
      // Only refresh if the page is visible
      if (!document.hidden) {
        const headers = {};
        const csrfToken = getCsrfToken();
        if (csrfToken) {
          headers['X-CSRF-Token'] = csrfToken;
        }
        fetch('/admin/dashboard/cms/data', {
          headers: headers
        })
          .then(response => response.json())
          .then(data => {
            // Update statistics
            if (data.statistics) {
              document.querySelectorAll('.stats-number').forEach((element, index) => {
                const values = [
                  data.statistics.totalPages,
                  data.statistics.publishedPages,
                  data.statistics.draftPages,
                  data.statistics.totalProjects
                ];
                if (values[index] !== undefined) {
                  element.textContent = values[index];
                }
              });
            }
          })
          .catch(error => {
            console.log('Dashboard refresh failed:', error);
          });
      }
    }, 300000); // 5 minutes
  }

  // Clean up interval when leaving the page
  window.addEventListener('beforeunload', function () {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  // Site Settings specific functions
  // Character count functionality for SEO fields
  const defaultTitle = document.getElementById('defaultTitle');
  const defaultTitleCount = document.getElementById('defaultTitleCount');

  if (defaultTitle && defaultTitleCount) {
    defaultTitle.addEventListener('input', function () {
      const length = this.value.length;
      defaultTitleCount.textContent = length + '/60';
      defaultTitleCount.className = 'character-count';

      if (length > 50) {
        defaultTitleCount.classList.add('warning');
      } else if (length > 60) {
        defaultTitleCount.classList.add('danger');
      }
    });
    defaultTitle.dispatchEvent(new Event('input'));
  }

  const defaultDescription = document.getElementById('defaultDescription');
  const defaultDescriptionCount = document.getElementById('defaultDescriptionCount');

  if (defaultDescription && defaultDescriptionCount) {
    defaultDescription.addEventListener('input', function () {
      const length = this.value.length;
      defaultDescriptionCount.textContent = length + '/160';
      defaultDescriptionCount.className = 'character-count';

      if (length > 140) {
        defaultDescriptionCount.classList.add('warning');
      } else if (length > 160) {
        defaultDescriptionCount.classList.add('danger');
      }
    });
    defaultDescription.dispatchEvent(new Event('input'));
  }

  // Image preview functionality
  const logoFile = document.getElementById('logoFile');
  const logoPreview = document.getElementById('logoPreview');

  if (logoFile && logoPreview) {
    logoFile.addEventListener('change', function () {
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
          logoPreview.innerHTML = `<img src="${e.target.result}" alt="Logo Preview" class="img-fluid" style="max-height: 100px;" />`;
        };
        reader.readAsDataURL(this.files[0]);
      }
    });
  }

  const faviconFile = document.getElementById('faviconFile');
  const faviconPreview = document.getElementById('faviconPreview');

  if (faviconFile && faviconPreview) {
    faviconFile.addEventListener('change', function () {
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
          faviconPreview.innerHTML = `<img src="${e.target.result}" alt="Favicon Preview" class="img-fluid" style="max-height: 32px;" />`;
        };
        reader.readAsDataURL(this.files[0]);
      }
    });
  }

  const siteImageFile = document.getElementById('siteImageFile');
  const siteImagePreview = document.getElementById('siteImagePreview');

  if (siteImageFile && siteImagePreview) {
    siteImageFile.addEventListener('change', function () {
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = function (e) {
          siteImagePreview.innerHTML = `<img src="${e.target.result}" alt="Site Image Preview" class="img-fluid" style="max-height: 150px;" />`;
        };
        reader.readAsDataURL(this.files[0]);
      }
    });
  }
});

/**
 * Delete site image
 * @param {string} imageType - The type of image to delete ('logo', 'favicon', 'siteImage')
 */
// Slider Management Functions
document.addEventListener('DOMContentLoaded', function () {
  // Initialize slider functionality if we're on a slider page
  if (window.location.pathname.includes('/admin/slider')) {
    initializeSliderFunctionality();
  }
});

function initializeSliderFunctionality() {
  // Delete slide functionality
  const deleteButtons = document.querySelectorAll('.delete-slide');
  deleteButtons.forEach(button => {
    button.addEventListener('click', function () {
      const slideId = this.getAttribute('data-slide-id');
      const modal = new bootstrap.Modal(document.getElementById('deleteSlideModal'));
      const confirmBtn = document.getElementById('confirmDeleteSlide');

      confirmBtn.onclick = function () {
        // Use fetch to make a proper DELETE request
        const headers = { 'Content-Type': 'application/json' };
        const csrfToken = getCsrfToken();
        if (csrfToken) {
          headers['X-CSRF-Token'] = csrfToken;
        }
        fetch(`/admin/slider/${slideId}`, {
          method: 'DELETE',
          headers: headers
        })
          .then(response => {
            if (response.ok) {
              // Remove the row from the table
              const row = button.closest('tr');
              if (row) {
                row.style.transition = 'opacity 0.3s';
                row.style.opacity = '0';
                setTimeout(() => {
                  row.remove();
                  // Check if table is empty and show empty state
                  const tbody = document.querySelector('tbody');
                  if (tbody.children.length === 0) {
                    tbody.innerHTML = `
                    <tr>
                      <td colspan="9" class="text-center py-4">
                        <div class="text-muted">
                          <i class="fa fa-images fa-3x mb-3"></i>
                          <h5>No slides found</h5>
                          <p>Get started by adding your first slide to the home page slider.</p>
                          <a href="/admin/slider/create" class="btn btn-primary">
                            <i class="fa fa-plus me-1"></i> Add First Slide
                          </a>
                        </div>
                      </td>
                    </tr>
                  `;
                  }
                }, 300);
              }
              // Close modal
              modal.hide();
              // Show success message
              showSuccessToast('Slide deleted successfully');
            } else {
              throw new Error('Failed to delete slide');
            }
          })
          .catch(error => {
            console.error('Error deleting slide:', error);
            showErrorToast('Failed to delete slide: ' + error.message);
          });
      };

      modal.show();
    });
  });

  // Image preview functionality for edit slide form
  const imageInput = document.getElementById('image');
  if (imageInput) {
    imageInput.addEventListener('change', function () {
      const file = this.files[0];
      const preview = document.getElementById('imagePreview');

      if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
          preview.innerHTML = `
            <img src="${e.target.result}" alt="Preview" class="img-fluid rounded" style="max-height: 200px; object-fit: cover;" />
            <div class="mt-2">
              <small class="text-muted">New Image Preview</small>
            </div>
          `;
        };
        reader.readAsDataURL(file);
      } else {
        // Reset to current image if available
        const currentImage = preview.querySelector('img');
        if (currentImage) {
          preview.innerHTML = currentImage.outerHTML + `
            <div class="mt-2">
              <small class="text-muted">Current Image</small>
            </div>
          `;
        }
      }
    });
  }

  // Filter functionality
  const keywordFilter = document.getElementById('keywordFilter');
  const statusFilter = document.getElementById('statusFilter');
  const clearFiltersBtn = document.getElementById('clearFilters');
  const tableRows = document.querySelectorAll('tbody tr[data-slide-id]');

  function applyFilters() {
    const keyword = keywordFilter.value.toLowerCase();
    const status = statusFilter.value;

    tableRows.forEach(row => {
      const altCell = row.querySelector('td:nth-child(3) .fw-bold');
      const altText = (altCell ? altCell.textContent : '').toLowerCase();
      const rowStatus = row.getAttribute('data-status');

      const matchesKeyword = altText.includes(keyword);
      const matchesStatus = !status || rowStatus === status;

      row.style.display = matchesKeyword && matchesStatus ? '' : 'none';
    });
  }

  if (keywordFilter) {
    keywordFilter.addEventListener('input', applyFilters);
  }

  if (statusFilter) {
    statusFilter.addEventListener('change', applyFilters);
  }

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener('click', function () {
      keywordFilter.value = '';
      statusFilter.value = '';
      applyFilters();
    });
  }
}

function deleteImage(imageType) {
  const imageNames = {
    'logo': 'Logo',
    'favicon': 'Favicon',
    'siteImage': 'Site Image'
  };

  const imageName = imageNames[imageType] || 'Image';

  showActionModal({
    title: `Delete ${imageName}`,
    message: `Are you sure you want to delete the ${imageName.toLowerCase()}? This action cannot be undone.`,
    endpoint: `/admin/site-settings/delete-image/${imageType}`,
    onSuccess: function (data) {
      if (data.success) {
        // Reload the page to show updated images
        window.location.reload();
        showSuccessToast(`${imageName} deleted successfully`);
      } else {
        showErrorToast(`Failed to delete ${imageName.toLowerCase()}: ${data.error || 'Unknown error'}`);
      }
    }
  });
}

// Handle site settings form submission
document.addEventListener('DOMContentLoaded', function () {
  const siteSettingsForm = document.getElementById('siteSettingsForm');
  if (siteSettingsForm) {
    siteSettingsForm.addEventListener('submit', function (e) {
      e.preventDefault();

      const submitBtn = siteSettingsForm.querySelector('button[type="submit"]');
      const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
      const translations = window.translations || {};
      const savingText = translations.saving || 'Saving...';
      const errorText = translations.errorOccurred || 'An error occurred while saving settings.';
      const successText = translations.settingsSaved || 'Settings saved successfully!';

      // Disable submit button and show loading state
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa fa-spinner fa-spin"></i> ${savingText}`;
      }
      
      
      // Allow native form submission to handle the request and redirect
      // This avoids issues with fetch following redirects to HTTPS in dev environment
      // e.preventDefault(); // Removed to allow native submission
      
      // Explicitly submit to ensure it happens despite button state changes
      siteSettingsForm.submit();
    });
  }

  // Product Image Management
  // Event delegation for product image delete buttons
  document.addEventListener('click', function (e) {
    const deleteBtn = e.target.closest('.delete-product-image-btn');
    if (deleteBtn) {
      const imageId = deleteBtn.getAttribute('data-image-id');
      const productId = window.productId || deleteBtn.closest('[data-product-id]')?.getAttribute('data-product-id');

      if (imageId && productId) {
        deleteProductImage(imageId, productId);
      }
      return;
    }

    const primaryBtn = e.target.closest('.set-primary-image-btn');
    if (primaryBtn) {
      const imageId = primaryBtn.getAttribute('data-image-id');
      const productId = window.productId || primaryBtn.closest('[data-product-id]')?.getAttribute('data-product-id');

      if (imageId && productId) {
        setPrimaryProductImage(imageId, productId);
      }
      return;
    }

    // Site Image Delete Management
    const deleteSiteImageBtn = e.target.closest('.delete-site-image-btn');
    if (deleteSiteImageBtn) {
      const imageType = deleteSiteImageBtn.getAttribute('data-image-type');
      if (imageType) {
        deleteImage(imageType);
      }
      return;
    }
  });
});

/**
 * Delete product image
 * @param {string|number} imageId - The ID of the image to delete
 * @param {string|number} productId - The ID of the product
 */
function deleteProductImage(imageId, productId) {
  const translations = window.translations || {};
  const title = translations.deleteImage || 'Delete Image';
  const message = translations.deleteImageConfirm || 'Are you sure you want to delete this image? This action cannot be undone.';

  showActionModal({
    title: title,
    message: message,
    endpoint: `/admin/products/${productId}/images/${imageId}`,
    method: 'DELETE',
    onSuccess: function (data) {
      if (data.success) {
        // Remove image from gallery
        const imageItem = document.querySelector(`.image-item[data-image-id="${imageId}"]`);
        if (imageItem) {
          imageItem.style.transition = 'opacity 0.3s';
          imageItem.style.opacity = '0';
          setTimeout(() => {
            imageItem.remove();
          }, 300);
        }

        // Show success message and reload to update main image if needed
        showSuccessToast(translations.imageDeletedSuccess || 'Image deleted successfully');
        setTimeout(() => {
          location.reload();
        }, 500);
      } else {
        showErrorToast(translations.deleteImageError || 'Failed to delete image: ' + (data.error || 'Unknown error'));
      }
    }
  });
}

/**
 * Drag product gallery thumbnails to reorder them.
 */
function initProductImageDrag() {
  const gallery = document.getElementById('imageGallery');
  if (!gallery) return;

  let dragged = null;
  let orderBeforeDrag = '';

  function currentOrder() {
    return Array.from(gallery.querySelectorAll('.image-item'))
      .map((item) => item.getAttribute('data-image-id'))
      .join(',');
  }

  gallery.addEventListener('dragstart', function (e) {
    if (e.target.closest('button')) {
      e.preventDefault();
      return;
    }
    const item = e.target.closest('.image-item');
    if (!item) return;
    dragged = item;
    orderBeforeDrag = currentOrder();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', item.getAttribute('data-image-id') || '');
    item.classList.add('opacity-50');
  });

  gallery.addEventListener('dragover', function (e) {
    if (!dragged) return;
    e.preventDefault();
    const target = e.target.closest('.image-item');
    if (!target || target === dragged) return;
    const items = Array.from(gallery.querySelectorAll('.image-item'));
    const draggedIndex = items.indexOf(dragged);
    const targetIndex = items.indexOf(target);
    if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex) return;
    if (draggedIndex < targetIndex) {
      target.after(dragged);
    } else {
      target.before(dragged);
    }
  });

  gallery.addEventListener('drop', function (e) {
    e.preventDefault();
  });

  gallery.addEventListener('dragend', function () {
    if (dragged) dragged.classList.remove('opacity-50');
    const changed = dragged && currentOrder() !== orderBeforeDrag;
    dragged = null;
    if (!changed) return;
    window.productImageJustDragged = true;
    setTimeout(function () { window.productImageJustDragged = false; }, 300);
    saveProductImageOrder();
  });
}

function saveProductImageOrder() {
  const gallery = document.getElementById('imageGallery');
  const productId = window.productId;
  if (!gallery || !productId) return;

  const imageIds = Array.from(gallery.querySelectorAll('.image-item'))
    .map((item) => parseInt(item.getAttribute('data-image-id'), 10))
    .filter((id) => !Number.isNaN(id));
  const translations = window.translations || {};
  const csrfToken = getCsrfToken();

  fetch(`/admin/products/${productId}/images/reorder`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify({
      image_ids: imageIds,
      _csrf: csrfToken
    })
  })
    .then(response => response.json())
    .then(data => {
      if (!data.success) {
        showErrorToast(data.error || translations.errorOccurred || 'Failed to reorder image');
        location.reload();
      }
    })
    .catch(error => {
      console.error('Error reordering product image:', error);
      showErrorToast(translations.errorOccurred || 'An error occurred while reordering the image');
      location.reload();
    });
}

document.addEventListener('DOMContentLoaded', initProductImageDrag);

/**
 * Set primary product image
 * @param {string|number} imageId - The ID of the image to set as primary
 * @param {string|number} productId - The ID of the product
 */
function setPrimaryProductImage(imageId, productId) {
  const translations = window.translations || {};
  const csrfToken = getCsrfToken();

  fetch(`/admin/products/${productId}/images/set-primary`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRF-Token': csrfToken
    },
    body: JSON.stringify({
      image_id: imageId
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        showSuccessToast(translations.primaryImageSet || 'Primary image updated successfully');
        setTimeout(() => {
          location.reload();
        }, 500);
      } else {
        showErrorToast(translations.setPrimaryImageError || 'Failed to set primary image: ' + (data.error || 'Unknown error'));
      }
    })
    .catch(error => {
      console.error('Error setting primary image:', error);
      showErrorToast(translations.errorOccurred || 'An error occurred while setting primary image');
    });
}

/**
 * Global URL Parameter handling for Toasts
 * Checks for 'success' or 'error' query parameters and shows appropriate toast
 */
document.addEventListener('DOMContentLoaded', function () {
  const urlParams = new URLSearchParams(window.location.search);
  const successMsg = urlParams.get('success');
  const errorMsg = urlParams.get('error');

  if (successMsg) {
    showToast(successMsg, 'success');
    // Optional: Clean URL parameters preventing toast on refresh
    const newUrl = window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
  }

  if (errorMsg) {
    showToast(errorMsg, 'error');
    const newUrl = window.location.pathname;
    window.history.replaceState({}, document.title, newUrl);
  }
});