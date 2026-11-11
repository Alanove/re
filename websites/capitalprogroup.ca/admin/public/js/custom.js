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
  actionBtn.onclick = function () {
    actionBtn.disabled = true;
    actionBtn.textContent = 'Processing...';
    fetch(endpoint, {
      method: method,
      headers: { 'Content-Type': 'application/json' },
    })
      .then(res => res.json())
      .then(data => {
        modal.hide();
        if (typeof onSuccess === 'function') onSuccess(data);
      })
      .catch(() => {
        modal.hide();
        showErrorToast('An error occurred.');
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
 * @param {string} [title='Delete'] - The modal title and action button text.
 * @param {string} [message='Are you sure you want to delete this item?'] - The confirmation message.
 */
function deleteItem(endpoint, btn, title = 'Delete', message = 'Are you sure you want to delete this item?') {
  showActionModal({
    title: title,
    message: message,
    endpoint: endpoint,
    onSuccess: function(data) {
      if (data.success && btn) {
        // Find the closest tr ancestor and remove it
        let row = btn.closest('tr');
        if (row) {
          row.style.transition = 'opacity 0.3s';
          row.style.opacity = '0';
          setTimeout(() => row.remove(), 300);
        }
        
        // Determine resource type from endpoint and show appropriate success message
        let successMessage = 'Item deleted successfully';
        if (endpoint.includes('/admin/users/')) {
          successMessage = 'User deleted successfully';
        } else if (endpoint.includes('/admin/pages/')) {
          successMessage = 'Page deleted successfully';
        } else if (endpoint.includes('/admin/projects/')) {
          successMessage = 'Project deleted successfully';
        } else if (endpoint.includes('/admin/clients/')) {
          successMessage = 'Client deleted successfully';
        }
        
        // Show success toast
        showSuccessToast(successMessage);
      } else {
        // Show error toast if deletion failed
        showErrorToast('Failed to delete item: ' + (data.message || 'Unknown error'));
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
function showToast({ message, type = 'info', duration = 5000, position = 'top-right' }) {
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
  source.addEventListener('change', function() {
    if (target.value === '') {
      target.value = prefix + source.value;
      target.dispatchEvent(new Event('input'));
    }
  });
}

/**
 * Convert title to URL-friendly key
 * @param {string} title - The title to convert
 * @returns {string} - URL-friendly key
 */
function titleToKey(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters except spaces and hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
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
 * Auto-generate SEO description from editor content
 * @param {string} targetId - ID of the description input field
 */
function autoGenerateDescription(targetId) {
  const descriptionInput = document.getElementById(targetId);
  if (!descriptionInput) return;
  
  // Try to find custom editor rich text content
  const customEditorRich = document.querySelector('.custom-editor-rich');
  if (customEditorRich) {
    const content = customEditorRich.innerHTML;
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
 * Dashboard specific functionality
 */
document.addEventListener('DOMContentLoaded', function() {
  // Dashboard stats cards - no animation
  const statsCards = document.querySelectorAll('.dashboard-stats-card');
  // Cards are already visible, no animation needed

  // Quick action buttons hover effect - removed translate effects
  const quickActionBtns = document.querySelectorAll('.quick-actions-panel .btn');
  quickActionBtns.forEach(btn => {
    btn.addEventListener('mouseenter', function() {
      // Only add shadow effect, no movement
    });
    
    btn.addEventListener('mouseleave', function() {
      // Reset any effects
    });
  });

  // Recent items table row hover effects - removed translate effects
  const tableRows = document.querySelectorAll('.recent-items-table tbody tr');
  tableRows.forEach(row => {
    row.addEventListener('mouseenter', function() {
      this.style.backgroundColor = 'rgba(0, 123, 255, 0.05)';
      this.style.transition = 'background-color 0.2s ease';
    });
    
    row.addEventListener('mouseleave', function() {
      this.style.backgroundColor = '';
    });
  });

  // Auto-refresh dashboard data every 5 minutes
  let refreshInterval;
  if (window.location.pathname === '/admin/dashboard') {
    refreshInterval = setInterval(() => {
      // Only refresh if the page is visible
      if (!document.hidden) {
        fetch('/admin/dashboard/data')
          .then(response => response.json())
          .then(data => {
            // Update statistics
            if (data.statistics) {
              document.querySelectorAll('.stats-number').forEach((element, index) => {
                const values = [
                  data.statistics.totalPages,
                  data.statistics.publishedPages,
                  data.statistics.draftPages
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
  window.addEventListener('beforeunload', function() {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  // Site Settings specific functions
  // Character count functionality for SEO fields
  const defaultTitle = document.getElementById('defaultTitle');
  const defaultTitleCount = document.getElementById('defaultTitleCount');
  
  if (defaultTitle && defaultTitleCount) {
    defaultTitle.addEventListener('input', function() {
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
    defaultDescription.addEventListener('input', function() {
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
    logoFile.addEventListener('change', function() {
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
          logoPreview.innerHTML = `<img src="${e.target.result}" alt="Logo Preview" class="img-fluid" style="max-height: 100px;" />`;
        };
        reader.readAsDataURL(this.files[0]);
      }
    });
  }

  const faviconFile = document.getElementById('faviconFile');
  const faviconPreview = document.getElementById('faviconPreview');
  
  if (faviconFile && faviconPreview) {
    faviconFile.addEventListener('change', function() {
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
          faviconPreview.innerHTML = `<img src="${e.target.result}" alt="Favicon Preview" class="img-fluid" style="max-height: 32px;" />`;
        };
        reader.readAsDataURL(this.files[0]);
      }
    });
  }

  const siteImageFile = document.getElementById('siteImageFile');
  const siteImagePreview = document.getElementById('siteImagePreview');
  
  if (siteImageFile && siteImagePreview) {
    siteImageFile.addEventListener('change', function() {
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
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
document.addEventListener('DOMContentLoaded', function() {
  // Initialize slider functionality if we're on a slider page
  if (window.location.pathname.includes('/admin/slider')) {
    initializeSliderFunctionality();
  }
});

function initializeSliderFunctionality() {
  // Delete slide functionality
  const deleteButtons = document.querySelectorAll('.delete-slide');
  deleteButtons.forEach(button => {
    button.addEventListener('click', function() {
      const slideId = this.getAttribute('data-slide-id');
      const modal = new bootstrap.Modal(document.getElementById('deleteSlideModal'));
      const confirmBtn = document.getElementById('confirmDeleteSlide');
      
      confirmBtn.onclick = function() {
        // Use fetch to make a proper DELETE request
        fetch(`/admin/slider/${slideId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          }
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
                      <td colspan="6" class="text-center py-4">
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
    imageInput.addEventListener('change', function() {
      const file = this.files[0];
      const preview = document.getElementById('imagePreview');
      
      if (file) {
        const reader = new FileReader();
        reader.onload = function(e) {
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
      const altText = row.querySelector('td:nth-child(2) .fw-bold').textContent.toLowerCase();
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
    clearFiltersBtn.addEventListener('click', function() {
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
    onSuccess: function(data) {
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

document.addEventListener('DOMContentLoaded', function () {
  const devLoginBtn = document.getElementById('dev-login-btn');
  if (!devLoginBtn) {
    return;
  }

  devLoginBtn.addEventListener('click', function () {
    const form = document.getElementById('admin-login-form');
    if (!form) {
      return;
    }

    const emailInput = form.querySelector('#email');
    const passwordInput = form.querySelector('#password');
    if (!emailInput || !passwordInput) {
      return;
    }

    emailInput.value = form.dataset.devEmail || '';
    passwordInput.value = form.dataset.devPassword || '';
    form.submit();
  });
});

document.addEventListener('DOMContentLoaded', function () {
  const devLoginBtn = document.getElementById('dev-login-btn');
  if (!devLoginBtn) {
    return;
  }

  devLoginBtn.addEventListener('click', function () {
    const form = document.getElementById('admin-login-form');
    if (!form) {
      return;
    }

    const emailInput = form.querySelector('#email');
    const passwordInput = form.querySelector('#password');
    if (!emailInput || !passwordInput) {
      return;
    }

    emailInput.value = form.dataset.devEmail || '';
    passwordInput.value = form.dataset.devPassword || '';
    form.submit();
  });
});