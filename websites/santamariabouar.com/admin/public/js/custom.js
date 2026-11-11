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

/**
 * Credits report: apply unallocated invoice credits to invoices; apply Credit - Owner to invoices; assign Credit - Owner to apartment.
 */
function initCreditsReportPage() {
  const root = document.getElementById('credits-report-page');
  if (!root) return;

  const allocateModalEl = document.getElementById('creditsReportAllocateModal');
  const assignModalEl = document.getElementById('creditsReportAssignOwnerModal');
  if (!allocateModalEl || !assignModalEl) return;

  const allocateModal = new bootstrap.Modal(allocateModalEl);
  const assignModal = new bootstrap.Modal(assignModalEl);

  /** @type {{ mode: 'credit'|'owner', creditId: number|null, transactionId: number|null, apartmentId: number, creditAmount: number }} */
  let allocateState = { mode: 'credit', creditId: null, transactionId: null, apartmentId: 0, creditAmount: 0 };

  function openCreditsAllocateModal(state) {
    allocateState = state;
    document.getElementById('creditsAllocateCreditAmount').textContent = state.creditAmount.toFixed(2);
    document.getElementById('creditsAllocateAmountInput').value = '';
    var intro = document.getElementById('creditsAllocateHelpIntro');
    var titleText = document.getElementById('creditsAllocateModalTitleText');
    if (intro) {
      intro.textContent =
        state.mode === 'owner'
          ? 'Remaining from this Credit - Owner transaction that can be applied to invoices:'
          : 'Credit balance for this line:';
    }
    if (titleText) {
      titleText.textContent =
        state.mode === 'owner' ? 'Apply Credit - Owner to invoice' : 'Apply credit to invoice';
    }
    const submitBtn = document.getElementById('creditsAllocateSubmitBtn');
    const sel = document.getElementById('creditsAllocateInvoiceSelect');
    sel.innerHTML = '';
    const loading = document.createElement('option');
    loading.value = '';
    loading.textContent = 'Loading…';
    sel.appendChild(loading);
    submitBtn.disabled = true;
    allocateModal.show();

    fetch('/admin/reports/api/credits-report/apartments/' + state.apartmentId + '/invoices')
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        sel.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent =
          data.success && data.invoices && data.invoices.length
            ? 'Select invoice…'
            : 'No unpaid invoices for this apartment';
        sel.appendChild(placeholder);
        if (!data.success || !data.invoices || !data.invoices.length) {
          submitBtn.disabled = true;
          return;
        }
        data.invoices.forEach(function (inv) {
          const opt = document.createElement('option');
          opt.value = String(inv.id);
          opt.textContent =
            '#' +
            inv.id +
            ' — ' +
            (inv.description || 'Invoice') +
            ' — ' +
            inv.invoiceDate +
            ' — Outstanding $' +
            inv.outstanding.toFixed(2);
          opt.dataset.outstanding = String(inv.outstanding);
          sel.appendChild(opt);
        });
        submitBtn.disabled = false;
      })
      .catch(function () {
        sel.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'Failed to load';
        sel.appendChild(placeholder);
        submitBtn.disabled = true;
        showErrorToast('Could not load invoices');
      });
  }

  document.querySelectorAll('[data-credits-allocate]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openCreditsAllocateModal({
        mode: 'credit',
        creditId: parseInt(btn.getAttribute('data-credit-id'), 10),
        transactionId: null,
        apartmentId: parseInt(btn.getAttribute('data-apartment-id'), 10),
        creditAmount: parseFloat(btn.getAttribute('data-credit-amount'))
      });
    });
  });

  document.querySelectorAll('[data-credits-allocate-owner]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      openCreditsAllocateModal({
        mode: 'owner',
        creditId: null,
        transactionId: parseInt(btn.getAttribute('data-txn-id'), 10),
        apartmentId: parseInt(btn.getAttribute('data-apartment-id'), 10),
        creditAmount: parseFloat(btn.getAttribute('data-allocatable-amount'))
      });
    });
  });

  document.getElementById('creditsAllocateSubmitBtn').addEventListener('click', function () {
    const sel = document.getElementById('creditsAllocateInvoiceSelect');
    const invoiceId = sel.value;
    if (!invoiceId) {
      showErrorToast('Select an invoice');
      return;
    }
    const submitBtn = document.getElementById('creditsAllocateSubmitBtn');
    const amountRaw = document.getElementById('creditsAllocateAmountInput').value.trim();
    const url =
      allocateState.mode === 'owner'
        ? '/admin/reports/api/credits-report/allocate-credit-owner'
        : '/admin/reports/api/credits-report/allocate-credit';
    const body =
      allocateState.mode === 'owner'
        ? { transactionId: allocateState.transactionId, invoiceId: parseInt(invoiceId, 10) }
        : { creditId: allocateState.creditId, invoiceId: parseInt(invoiceId, 10) };
    if (amountRaw) body.amount = parseFloat(amountRaw);
    submitBtn.disabled = true;
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data.success) {
          allocateModal.hide();
          showSuccessToast(`Applied $${data.allocated.toFixed(2)} to the invoice`);
          window.location.reload();
        } else {
          showErrorToast(data.message || 'Allocation failed');
        }
      })
      .catch(function () {
        showErrorToast('Request failed');
      })
      .finally(function () {
        submitBtn.disabled = false;
      });
  });

  document.querySelectorAll('[data-credits-assign-owner]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.getElementById('creditsAssignTxnId').value = btn.getAttribute('data-txn-id');
      document.getElementById('creditsAssignApartmentSelect').value = '';
      assignModal.show();
    });
  });

  document.getElementById('creditsAssignSubmitBtn').addEventListener('click', function () {
    const transactionId = parseInt(document.getElementById('creditsAssignTxnId').value, 10);
    const apartmentId = parseInt(document.getElementById('creditsAssignApartmentSelect').value, 10);
    if (!apartmentId) {
      showErrorToast('Select an apartment');
      return;
    }
    fetch('/admin/reports/api/credits-report/assign-owner-apartment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transactionId: transactionId, apartmentId: apartmentId })
    })
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (data.success) {
          assignModal.hide();
          showSuccessToast('Apartment assigned');
          window.location.reload();
        } else {
          showErrorToast(data.message || 'Assignment failed');
        }
      })
      .catch(function () {
        showErrorToast('Request failed');
      });
  });
}

document.addEventListener('DOMContentLoaded', initCreditsReportPage);
document.addEventListener('DOMContentLoaded', initApartmentWalletDetailPage);
document.addEventListener('DOMContentLoaded', initPayInvoicePage);
document.addEventListener('DOMContentLoaded', initInvoiceReceiptModal);

/**
 * Invoice payment receipt modal (invoices list + pay invoice page).
 */
function initInvoiceReceiptModal() {
  const modalEl = document.getElementById('invoiceReceiptModal');
  if (!modalEl) return;

  const modal = new bootstrap.Modal(modalEl);
  const dateInput = document.getElementById('invoiceReceiptDate');
  const walletInput = document.getElementById('invoiceReceiptWallet');
  const cashInput = document.getElementById('invoiceReceiptCash');
  const totalSpan = document.getElementById('invoiceReceiptTotal');
  const feedback = document.getElementById('invoiceReceiptFeedback');
  const submitBtn = document.getElementById('invoiceReceiptSubmitBtn');
  const invoiceIdLabel = document.getElementById('invoiceReceiptInvoiceId');
  const descLabel = document.getElementById('invoiceReceiptDescription');

  let currentInvoiceId = null;
  let currentCashTransactionId = null;

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function updateReceiptTotal() {
    const total = round2((parseFloat(walletInput.value) || 0) + (parseFloat(cashInput.value) || 0));
    if (totalSpan) totalSpan.textContent = total.toFixed(2);
    if (feedback) feedback.classList.add('d-none');
  }

  function showReceiptError(msg) {
    if (!feedback) return;
    feedback.textContent = msg;
    feedback.classList.remove('d-none');
  }

  async function openInvoiceReceiptModal(invoiceId) {
    currentInvoiceId = invoiceId;
    currentCashTransactionId = null;
    if (feedback) feedback.classList.add('d-none');
    if (invoiceIdLabel) invoiceIdLabel.textContent = String(invoiceId);
    if (descLabel) descLabel.textContent = 'Loading...';

    modal.show();

    try {
      const res = await fetch('/admin/api/invoices/' + invoiceId + '/payment-breakdown');
      const data = await res.json();
      if (!data.success) {
        showReceiptError(data.message || 'Could not load payment details');
        return;
      }

      if (descLabel) {
        descLabel.textContent = data.invoice.description || ('Amount paid: $' + data.invoice.amountPaid.toFixed(2));
      }
      if (dateInput) dateInput.value = data.breakdown.suggestedDate || new Date().toISOString().split('T')[0];
      if (walletInput) walletInput.value = (data.breakdown.walletAmount || 0).toFixed(2);
      if (cashInput) cashInput.value = (data.breakdown.cashAmount || 0).toFixed(2);
      currentCashTransactionId = data.breakdown.cashTransactionId || null;
      updateReceiptTotal();
    } catch (e) {
      showReceiptError('Failed to load payment details.');
    }
  }

  document.querySelectorAll('.invoice-receipt-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      const id = parseInt(btn.getAttribute('data-invoice-id') || '', 10);
      if (Number.isFinite(id)) openInvoiceReceiptModal(id);
    });
  });

  if (walletInput) walletInput.addEventListener('input', updateReceiptTotal);
  if (cashInput) cashInput.addEventListener('input', updateReceiptTotal);

  if (submitBtn) {
    submitBtn.addEventListener('click', function() {
      if (!currentInvoiceId) return;

      const walletAmt = round2(parseFloat(walletInput.value) || 0);
      const cashAmt = round2(parseFloat(cashInput.value) || 0);
      const total = round2(walletAmt + cashAmt);
      const date = dateInput ? dateInput.value : '';

      if (total <= 0) {
        showReceiptError('Enter at least one amount (wallet or cash) for the receipt.');
        return;
      }
      if (!date) {
        showReceiptError('Please select a payment date.');
        return;
      }

      const q = new URLSearchParams();
      if (walletAmt > 0) q.set('walletAmount', walletAmt.toFixed(2));
      if (cashAmt > 0) q.set('cashAmount', cashAmt.toFixed(2));
      q.set('date', date);
      if (cashAmt > 0 && currentCashTransactionId) {
        q.set('transactionId', String(currentCashTransactionId));
      }

      window.open('/admin/invoices/' + currentInvoiceId + '/payment-receipt?' + q.toString(), '_blank');
      modal.hide();
    });
  }
}

/**
 * Pay invoice form: wallet + cash payment, dynamic validation.
 */
function initPayInvoicePage() {
  const form = document.getElementById('payInvoiceForm');
  if (!form) return;

  const balance = parseFloat(form.getAttribute('data-balance') || '0');
  const walletBalance = parseFloat(form.getAttribute('data-wallet-balance') || '0');
  const invoiceId = form.getAttribute('data-invoice-id');

  const walletInput = document.getElementById('payInvoiceWalletAmount');
  const cashInput = document.getElementById('payInvoiceCashAmount');
  const dateInput = document.getElementById('payInvoiceDate');
  const accountSelect = document.getElementById('payInvoiceAccount');
  const totalSpan = document.getElementById('payInvoiceTotal');
  const feedback = document.getElementById('payInvoiceFeedback');
  const submitBtn = document.getElementById('payInvoiceSubmitBtn');
  const dateRequired = document.getElementById('payInvoiceDateRequired');
  const accountRequired = document.getElementById('payInvoiceAccountRequired');

  function round2(n) {
    return Math.round(n * 100) / 100;
  }

  function getWalletAmount() {
    return walletInput ? (parseFloat(walletInput.value) || 0) : 0;
  }

  function getCashAmount() {
    return cashInput ? (parseFloat(cashInput.value) || 0) : 0;
  }

  function updateSummary() {
    const walletAmt = getWalletAmount();
    const cashAmt = getCashAmount();
    const total = round2(walletAmt + cashAmt);

    if (totalSpan) {
      totalSpan.textContent = total.toFixed(2);
    }

    const cashRequired = cashAmt > 0.001;
    if (accountSelect) accountSelect.required = cashRequired;
    if (accountRequired) accountRequired.style.display = cashRequired ? '' : 'none';

    if (feedback) feedback.classList.add('d-none');
  }

  function showError(message) {
    if (!feedback) return;
    feedback.textContent = message;
    feedback.classList.remove('d-none');
  }

  if (walletInput) {
    walletInput.addEventListener('input', function() {
      let walletAmt = parseFloat(walletInput.value) || 0;
      const maxWallet = round2(Math.min(walletBalance, balance));
      if (walletAmt > maxWallet) {
        walletAmt = maxWallet;
        walletInput.value = maxWallet.toFixed(2);
      }
      updateSummary();
    });
  }

  if (cashInput) {
    cashInput.addEventListener('input', function() {
      let cashAmt = parseFloat(cashInput.value) || 0;
      const walletAmt = getWalletAmount();
      const maxCash = round2(Math.max(0, balance - walletAmt));
      if (cashAmt > maxCash) {
        cashAmt = maxCash;
        cashInput.value = maxCash.toFixed(2);
      }
      updateSummary();
    });
  }

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    const walletAmt = round2(getWalletAmount());
    const cashAmt = round2(getCashAmount());
    const total = round2(walletAmt + cashAmt);

    if (total <= 0) {
      showError('Enter an amount from wallet and/or cash payment.');
      return;
    }
    if (total > balance + 0.009) {
      showError('Total payment exceeds invoice balance ($' + balance.toFixed(2) + ').');
      return;
    }
    if (walletAmt > walletBalance + 0.009) {
      showError('Wallet amount exceeds available balance ($' + walletBalance.toFixed(2) + ').');
      return;
    }
    if (cashAmt > 0 && !accountSelect.value) {
      showError('Please select an account for the cash payment.');
      return;
    }
    if (!dateInput || !dateInput.value) {
      showError('Please enter a payment date for the receipt.');
      return;
    }

    const payload = {
      walletAmount: walletAmt,
      amount: cashAmt,
      date: dateInput ? dateInput.value : '',
      accountId: accountSelect ? accountSelect.value : '',
      description: (form.querySelector('[name="description"]') || {}).value || ''
    };

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Recording...';
    }

    try {
      const response = await fetch('/admin/invoices/' + invoiceId + '/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();
      if (result.success) {
        window.location.href = '/admin/invoices?success=' + encodeURIComponent(result.message || 'Payment recorded successfully');
      } else {
        showError(result.message || 'Failed to record payment');
      }
    } catch (error) {
      console.error('Error:', error);
      showError('Error recording payment. Please try again.');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'Record Payment';
      }
    }
  });

  updateSummary();
}

/**
 * Apartment wallet detail: add/edit/delete wallet entries (runs after Bootstrap loads).
 */
function initApartmentWalletDetailPage() {
  const root = document.getElementById('wallet-detail-page');
  if (!root) return;

  const apartmentId = parseInt(root.getAttribute('data-apartment-id') || '', 10);
  if (!Number.isFinite(apartmentId)) return;

  const addModalEl = document.getElementById('addWalletModal');
  const subtractModalEl = document.getElementById('subtractWalletModal');
  const editModalEl = document.getElementById('editWalletModal');
  const deleteModalEl = document.getElementById('deleteWalletModal');
  if (!addModalEl || !subtractModalEl || !editModalEl || !deleteModalEl) return;

  const addModal = new bootstrap.Modal(addModalEl);
  const subtractModal = new bootstrap.Modal(subtractModalEl);
  const editModal = new bootstrap.Modal(editModalEl);
  const deleteModal = new bootstrap.Modal(deleteModalEl);

  let editingEntryId = null;
  let editingIsDeduction = false;
  let deletingEntryId = null;

  function showFeedback(elId, message, isError) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.className = isError ? 'alert alert-danger' : 'alert alert-success';
    el.textContent = message;
    el.classList.remove('d-none');
  }

  function resetFeedback() {
    ['addWalletFeedback', 'subtractWalletFeedback', 'editWalletFeedback', 'deleteWalletFeedback'].forEach(function(id) {
      const el = document.getElementById(id);
      if (el) {
        el.classList.add('d-none');
        el.textContent = '';
      }
    });
  }

  function openAddModal() {
    resetFeedback();
    const amountEl = document.getElementById('addWalletAmount');
    if (amountEl) amountEl.value = '';
    addModal.show();
  }

  function openSubtractModal() {
    resetFeedback();
    const amountEl = document.getElementById('subtractWalletAmount');
    if (amountEl) amountEl.value = '';
    const descriptionEl = document.getElementById('subtractWalletDescription');
    if (descriptionEl) descriptionEl.value = '';
    subtractModal.show();
  }

  const openAddBtn = document.getElementById('openAddWalletBtn');
  if (openAddBtn) {
    openAddBtn.addEventListener('click', openAddModal);
  }

  const openSubtractBtn = document.getElementById('openSubtractWalletBtn');
  if (openSubtractBtn) {
    openSubtractBtn.addEventListener('click', openSubtractModal);
  }

  const openAction = root.getAttribute('data-open-action');
  if (openAction === 'add' || openAction === 'subtract') {
    // Drop ?action=... from the URL so a reload after saving doesn't re-open the modal
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('action');
    window.history.replaceState({}, '', cleanUrl.toString());
    if (openAction === 'add') {
      openAddModal();
    } else {
      openSubtractModal();
    }
  }

  document.querySelectorAll('.wallet-edit-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      resetFeedback();
      editingEntryId = parseInt(btn.getAttribute('data-entry-id') || '', 10);
      const amount = parseFloat(btn.getAttribute('data-entry-amount') || '0');
      editingIsDeduction = amount < 0;
      const hasTransaction = btn.getAttribute('data-has-transaction') === '1';
      let description = '';
      try {
        description = decodeURIComponent(btn.getAttribute('data-entry-description') || '');
      } catch (e) {
        description = btn.getAttribute('data-entry-description') || '';
      }

      const amountEl = document.getElementById('editWalletAmount');
      if (amountEl) amountEl.value = Math.abs(amount).toFixed(2);

      const typeLabel = document.getElementById('editWalletTypeLabel');
      if (typeLabel) {
        typeLabel.textContent = amount < 0
          ? 'This entry is a deduction — the amount stays subtracted from the wallet.'
          : 'This entry adds to the wallet balance.';
      }

      const descriptionEl = document.getElementById('editWalletDescription');
      const requiredMark = document.getElementById('editWalletDescriptionRequiredMark');
      const hintEl = document.getElementById('editWalletDescriptionHint');
      if (descriptionEl) {
        descriptionEl.value = description;
        descriptionEl.disabled = !hasTransaction;
      }
      if (requiredMark) {
        requiredMark.style.display = editingIsDeduction ? 'inline' : 'none';
      }
      if (hintEl) {
        hintEl.textContent = hasTransaction
          ? (editingIsDeduction ? 'Description is required for deductions.' : 'Optional for top-ups.')
          : 'This entry has no linked transaction, so description cannot be edited.';
      }

      editModal.show();
    });
  });

  document.querySelectorAll('.wallet-delete-btn').forEach(function(btn) {
    btn.addEventListener('click', function() {
      resetFeedback();
      deletingEntryId = parseInt(btn.getAttribute('data-entry-id') || '', 10);
      const amount = parseFloat(btn.getAttribute('data-entry-amount') || '0');
      const label = document.getElementById('deleteWalletAmountLabel');
      if (label) label.textContent = (amount < 0 ? '-$' : '+$') + Math.abs(amount).toFixed(2);
      deleteModal.show();
    });
  });

  const addSubmitBtn = document.getElementById('addWalletSubmitBtn');
  if (addSubmitBtn) {
    addSubmitBtn.addEventListener('click', async function() {
      const amount = parseFloat((document.getElementById('addWalletAmount') || {}).value || '');
      const accountId = parseInt((document.getElementById('addWalletAccount') || {}).value || '', 10);
      const date = ((document.getElementById('addWalletDate') || {}).value || '').trim();
      const description = ((document.getElementById('addWalletDescription') || {}).value || '').trim();

      if (!amount || amount <= 0) {
        showFeedback('addWalletFeedback', 'Please enter a valid amount greater than zero.', true);
        return;
      }
      if (!Number.isFinite(accountId)) {
        showFeedback('addWalletFeedback', 'Please select an account.', true);
        return;
      }
      if (!date) {
        showFeedback('addWalletFeedback', 'Please select a date.', true);
        return;
      }

      addSubmitBtn.disabled = true;
      addSubmitBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving...';
      try {
        const res = await fetch('/admin/wallets/' + apartmentId + '/add', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, accountId, date, description })
        });
        const data = await res.json();
        if (data.success) {
          window.location.reload();
        } else {
          showFeedback('addWalletFeedback', data.message || 'Failed to add entry', true);
        }
      } catch (e) {
        showFeedback('addWalletFeedback', 'Network error. Please try again.', true);
      } finally {
        addSubmitBtn.disabled = false;
        addSubmitBtn.innerHTML = '<i class="fa fa-save"></i> Record & Add Balance';
      }
    });
  }

  const subtractSubmitBtn = document.getElementById('subtractWalletSubmitBtn');
  if (subtractSubmitBtn) {
    subtractSubmitBtn.addEventListener('click', async function() {
      const amount = parseFloat((document.getElementById('subtractWalletAmount') || {}).value || '');
      const accountId = parseInt((document.getElementById('subtractWalletAccount') || {}).value || '', 10);
      const date = ((document.getElementById('subtractWalletDate') || {}).value || '').trim();
      const description = ((document.getElementById('subtractWalletDescription') || {}).value || '').trim();

      if (!amount || amount <= 0) {
        showFeedback('subtractWalletFeedback', 'Please enter a valid amount greater than zero.', true);
        return;
      }
      if (!Number.isFinite(accountId)) {
        showFeedback('subtractWalletFeedback', 'Please select an account.', true);
        return;
      }
      if (!date) {
        showFeedback('subtractWalletFeedback', 'Please select a date.', true);
        return;
      }
      if (!description) {
        showFeedback('subtractWalletFeedback', 'Please enter a description for this deduction.', true);
        return;
      }

      subtractSubmitBtn.disabled = true;
      subtractSubmitBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving...';
      try {
        const res = await fetch('/admin/wallets/' + apartmentId + '/subtract', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount, accountId, date, description })
        });
        const data = await res.json();
        if (data.success) {
          window.location.reload();
        } else {
          showFeedback('subtractWalletFeedback', data.message || 'Failed to subtract balance', true);
        }
      } catch (e) {
        showFeedback('subtractWalletFeedback', 'Network error. Please try again.', true);
      } finally {
        subtractSubmitBtn.disabled = false;
        subtractSubmitBtn.innerHTML = '<i class="fa fa-save"></i> Record & Subtract Balance';
      }
    });
  }

  const editSubmitBtn = document.getElementById('editWalletSubmitBtn');
  if (editSubmitBtn) {
    editSubmitBtn.addEventListener('click', async function() {
      const amount = parseFloat((document.getElementById('editWalletAmount') || {}).value || '');
      const descriptionEl = document.getElementById('editWalletDescription');
      const description = descriptionEl && !descriptionEl.disabled
        ? (descriptionEl.value || '').trim()
        : undefined;

      if (!editingEntryId || !amount || amount <= 0) {
        showFeedback('editWalletFeedback', 'Please enter a valid amount greater than zero.', true);
        return;
      }
      if (editingIsDeduction && descriptionEl && !descriptionEl.disabled && !description) {
        showFeedback('editWalletFeedback', 'Please enter a description for this deduction.', true);
        return;
      }

      editSubmitBtn.disabled = true;
      editSubmitBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Saving...';
      try {
        const payload = { amount };
        if (description !== undefined) {
          payload.description = description;
        }
        const res = await fetch('/admin/wallets/entries/' + editingEntryId + '/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success) {
          window.location.reload();
        } else {
          showFeedback('editWalletFeedback', data.message || 'Failed to update entry', true);
        }
      } catch (e) {
        showFeedback('editWalletFeedback', 'Network error. Please try again.', true);
      } finally {
        editSubmitBtn.disabled = false;
        editSubmitBtn.innerHTML = '<i class="fa fa-save"></i> Save Changes';
      }
    });
  }

  const deleteSubmitBtn = document.getElementById('deleteWalletSubmitBtn');
  if (deleteSubmitBtn) {
    deleteSubmitBtn.addEventListener('click', async function() {
      if (!deletingEntryId) return;
      deleteSubmitBtn.disabled = true;
      deleteSubmitBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Removing...';
      try {
        const res = await fetch('/admin/wallets/entries/' + deletingEntryId + '/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        if (data.success) {
          window.location.reload();
        } else {
          showFeedback('deleteWalletFeedback', data.message || 'Failed to delete entry', true);
        }
      } catch (e) {
        showFeedback('deleteWalletFeedback', 'Network error. Please try again.', true);
      } finally {
        deleteSubmitBtn.disabled = false;
        deleteSubmitBtn.innerHTML = '<i class="fa fa-trash"></i> Remove Entry';
      }
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
        window.location.reload();
        showSuccessToast(`${imageName} deleted successfully`);
      } else {
        showErrorToast(`Failed to delete ${imageName.toLowerCase()}: ${data.error || 'Unknown error'}`);
      }
    }
  });
}

function initSafemateUsersPage() {
  const page = document.getElementById('safemate-users-page');
  if (!page) return;

  const addModalEl = document.getElementById('safemateAddModal');
  const revokeModalEl = document.getElementById('safemateRevokeModal');
  if (!addModalEl || !revokeModalEl || typeof bootstrap === 'undefined') return;

  const addModal = new bootstrap.Modal(addModalEl);
  const revokeModal = new bootstrap.Modal(revokeModalEl);

  page.querySelectorAll('.js-safemate-add').forEach(function(button) {
    button.addEventListener('click', function() {
      document.getElementById('safemateAddAccount').value = button.getAttribute('data-account') || '';
      document.getElementById('safemateAddPhone').value = button.getAttribute('data-phone') || '';
      document.getElementById('safemateAddEmail').value = button.getAttribute('data-email') || '';
      document.getElementById('safemateAddName').value = button.getAttribute('data-name') || '';
      document.getElementById('safemateAddApartment').value = '';
      const relation = document.getElementById('safemateAddRelation');
      if (relation) relation.value = 'Guest';
      const submit = document.getElementById('safemateAddSubmit');
      submit.disabled = false;
      submit.textContent = 'Create user';
      addModal.show();
    });
  });

  let revokeRow = null;

  function clearRevokeError() {
    const errorBox = document.getElementById('safemateRevokeError');
    if (!errorBox) return;
    errorBox.textContent = '';
    errorBox.classList.add('d-none');
  }

  function showRevokeError(message) {
    const errorBox = document.getElementById('safemateRevokeError');
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.classList.remove('d-none');
  }

  function updateSafemateCount() {
    const count = document.getElementById('safemate-count');
    if (!count) return;
    const shown = Math.max(0, parseInt(count.getAttribute('data-shown') || '0', 10) - 1);
    const total = Math.max(0, parseInt(count.getAttribute('data-total') || '0', 10) - 1);
    count.setAttribute('data-shown', String(shown));
    count.setAttribute('data-total', String(total));
    count.textContent = 'Showing ' + shown + ' of ' + total + '.';
    if (shown === 0) {
      const tbody = page.querySelector('tbody');
      if (tbody && !tbody.querySelector('tr')) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center">No SafeMate users match these filters.</td></tr>';
      }
    }
  }

  page.querySelectorAll('.js-safemate-revoke').forEach(function(button) {
    button.addEventListener('click', function() {
      revokeRow = button.closest('tr');
      document.getElementById('safemateRevokeAccount').value = button.getAttribute('data-account') || '';
      document.getElementById('safemateRevokePhone').value = button.getAttribute('data-phone') || '';
      const detail = document.getElementById(button.getAttribute('data-detail-id') || '');
      document.getElementById('safemateRevokeBody').innerHTML = detail ? detail.innerHTML : '';
      clearRevokeError();
      const submit = document.getElementById('safemateRevokeSubmit');
      submit.disabled = false;
      submit.textContent = 'Revoke access';
      revokeModal.show();
    });
  });

  document.getElementById('safemateAddForm').addEventListener('submit', function() {
    const submit = document.getElementById('safemateAddSubmit');
    setTimeout(function() {
      submit.disabled = true;
      submit.textContent = 'Saving...';
    }, 0);
  });
  document.getElementById('safemateRevokeForm').addEventListener('submit', function(event) {
    event.preventDefault();
    const submit = document.getElementById('safemateRevokeSubmit');
    submit.disabled = true;
    submit.textContent = 'Revoking...';
    clearRevokeError();

    const body = new URLSearchParams();
    body.set('account', document.getElementById('safemateRevokeAccount').value);
    body.set('phone', document.getElementById('safemateRevokePhone').value);

    fetch('/admin/main-gate/safemate/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: body
    })
      .then(function(response) {
        return response.json().then(function(data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function(result) {
        if (!result.ok || !result.data || !result.data.success) {
          const message = result.data && result.data.message ? result.data.message : 'Failed to revoke access';
          showRevokeError(message);
          submit.disabled = false;
          submit.textContent = 'Revoke access';
          return;
        }
        if (revokeRow) {
          revokeRow.remove();
          revokeRow = null;
          updateSafemateCount();
        }
        revokeModal.hide();
        showSuccessToast(result.data.message || 'Access revoked');
      })
      .catch(function() {
        showRevokeError('Failed to revoke access');
        submit.disabled = false;
        submit.textContent = 'Revoke access';
      });
  });

  initSafemateTableSort(page);
}

function initSafemateTableSort(page) {
  const table = page.querySelector('table');
  if (!table) return;

  const headers = table.querySelectorAll('th.sortable');
  let currentColumn = -1;
  let direction = 'asc';

  function cellText(row, index) {
    const cell = row.cells[index];
    if (!cell) return '';
    const text = cell.textContent.replace(/\s+/g, ' ').trim();
    if (text === '—' || text === '-' || text === '–') return '';
    return text;
  }

  headers.forEach(function(header) {
    header.addEventListener('click', function() {
      const column = header.cellIndex;
      const tbody = table.querySelector('tbody');
      const rows = Array.from(tbody.querySelectorAll('tr')).filter(function(row) {
        return !row.querySelector('td[colspan]');
      });

      headers.forEach(function(item) {
        item.classList.remove('sort-asc', 'sort-desc');
        const icon = item.querySelector('i');
        if (icon) icon.className = 'fa fa-sort';
      });

      if (currentColumn === column && direction === 'asc') {
        direction = 'desc';
      } else {
        direction = 'asc';
      }
      currentColumn = column;
      header.classList.add(direction === 'asc' ? 'sort-asc' : 'sort-desc');
      const icon = header.querySelector('i');
      if (icon) icon.className = direction === 'asc' ? 'fa fa-sort-asc' : 'fa fa-sort-desc';

      const multiplier = direction === 'asc' ? 1 : -1;
      rows.sort(function(a, b) {
        const aText = cellText(a, column);
        const bText = cellText(b, column);
        if (!aText && !bText) return 0;
        if (!aText) return 1;
        if (!bText) return -1;
        return aText.localeCompare(bText, undefined, { numeric: true, sensitivity: 'base' }) * multiplier;
      });
      rows.forEach(function(row) {
        tbody.appendChild(row);
      });
    });
  });
}

function initSafemateDirectPage() {
  const page = document.getElementById('safemate-direct-page');
  if (!page || typeof bootstrap === 'undefined') return;

  const addModalEl = document.getElementById('safemateDirectAddModal');
  const editModalEl = document.getElementById('safemateDirectEditModal');
  const deleteModalEl = document.getElementById('safemateDirectDeleteModal');
  if (!addModalEl || !editModalEl || !deleteModalEl) return;

  const addModal = new bootstrap.Modal(addModalEl);
  const editModal = new bootstrap.Modal(editModalEl);
  const deleteModal = new bootstrap.Modal(deleteModalEl);

  const addOpen = document.getElementById('safemateDirectAddOpen');
  if (addOpen) {
    addOpen.addEventListener('click', function() {
      document.getElementById('safemateDirectAddAccount').value = '';
      document.getElementById('safemateDirectAddName').value = '';
      document.getElementById('safemateDirectAddEmail').value = '';
      document.getElementById('safemateDirectAddValid').value = '';
      const submit = document.getElementById('safemateDirectAddSubmit');
      submit.disabled = false;
      submit.textContent = 'Create account';
      addModal.show();
    });
  }

  page.querySelectorAll('.js-safemate-direct-edit').forEach(function(button) {
    button.addEventListener('click', function() {
      document.getElementById('safemateDirectEditAccount').value = button.getAttribute('data-account') || '';
      document.getElementById('safemateDirectEditName').value = '';
      document.getElementById('safemateDirectEditEmail').value = button.getAttribute('data-email') || '';
      document.getElementById('safemateDirectEditValid').value = button.getAttribute('data-valid') || '';
      const submit = document.getElementById('safemateDirectEditSubmit');
      submit.disabled = false;
      submit.textContent = 'Save';
      editModal.show();
    });
  });

  page.querySelectorAll('.js-safemate-direct-delete').forEach(function(button) {
    button.addEventListener('click', function() {
      const account = button.getAttribute('data-account') || '';
      document.getElementById('safemateDirectDeleteAccount').value = account;
      document.getElementById('safemateDirectDeleteLabel').textContent = account;
      const submit = document.getElementById('safemateDirectDeleteSubmit');
      submit.disabled = false;
      submit.textContent = 'Delete';
      deleteModal.show();
    });
  });

  ['safemateDirectAddForm', 'safemateDirectEditForm', 'safemateDirectDeleteForm'].forEach(function(formId) {
    const form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener('submit', function() {
      const submit = form.querySelector('button[type="submit"]');
      if (!submit) return;
      setTimeout(function() {
        submit.disabled = true;
        submit.textContent = 'Saving...';
      }, 0);
    });
  });

  initSafemateTableSort(page);
}

document.addEventListener('DOMContentLoaded', initSafemateUsersPage);
document.addEventListener('DOMContentLoaded', initSafemateDirectPage);
document.addEventListener('DOMContentLoaded', initMainGateAccessPage);

function initMainGateAccessPage() {
  const modalEl = document.getElementById('addGateAccessModal');
  const dataEl = document.getElementById('main-gate-access-choices');
  if (!modalEl || !dataEl) return;

  let choices = { apartments: [], users: [] };
  try {
    choices = JSON.parse(dataEl.textContent || '{}');
  } catch (error) {
    choices = { apartments: [], users: [] };
  }

  const form = modalEl.querySelector('form');
  const errorBox = document.getElementById('addGateAccessError');
  const apartmentInput = document.getElementById('addApartmentSearch');
  const apartmentId = document.getElementById('addApartmentId');
  const apartmentResults = document.getElementById('addApartmentResults');
  const personInput = document.getElementById('addPersonSearch');
  const userId = document.getElementById('addUserId');
  const personResults = document.getElementById('addPersonResults');
  const nameInput = document.getElementById('addName');
  const phoneInput = document.getElementById('addPhone');
  const emailInput = document.getElementById('addEmail');
  if (!form || !apartmentInput || !apartmentId || !apartmentResults || !personInput || !userId || !personResults || !nameInput || !phoneInput || !emailInput) {
    return;
  }

  let fillingPerson = false;
  let selectedPhone = '';

  function normalizeQuery(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/\bblocks?\b/g, ' ')
      .replace(/[–—\-_,.()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function compact(value) {
    return normalizeQuery(value).replace(/\s/g, '');
  }

  function showError(message) {
    if (!errorBox) return;
    errorBox.textContent = message;
    errorBox.classList.remove('d-none');
  }

  function clearError() {
    if (!errorBox) return;
    errorBox.textContent = '';
    errorBox.classList.add('d-none');
  }

  function hideResults(list) {
    list.classList.add('d-none');
    list.innerHTML = '';
  }

  function apartmentTokens(apartment) {
    return {
      block: normalizeQuery(apartment.block),
      unit: normalizeQuery(apartment.unit),
      unofficial: normalizeQuery(apartment.unofficial),
      ownerWords: normalizeQuery(apartment.owner).split(' ').filter(Boolean),
      code: compact(apartment.block + ' ' + apartment.unit)
    };
  }

  function tokenMatchesApartment(apartment, part) {
    const fields = apartmentTokens(apartment);
    if (!part) return true;
    if (fields.block === part || fields.block.indexOf(part) === 0) return true;
    if (fields.unit === part || fields.unit.indexOf(part) === 0) return true;
    if (fields.unofficial && (fields.unofficial === part || fields.unofficial.indexOf(part) === 0)) return true;
    if (fields.ownerWords.some(function(word) { return word.indexOf(part) === 0; })) return true;
    if (fields.code === part || fields.code.indexOf(part) === 0) return true;
    return false;
  }

  function matchesApartment(apartment, query) {
    const parts = normalizeQuery(query).split(' ').filter(Boolean);
    if (!parts.length) return true;
    if (parts.length === 1 && compact(query).length > 1 && apartmentTokens(apartment).code.indexOf(compact(query)) === 0) {
      return true;
    }
    return parts.every(function(part) {
      return tokenMatchesApartment(apartment, part);
    });
  }

  function renderResults(list, items, onPick) {
    list.innerHTML = '';
    if (!items.length) {
      list.innerHTML = '<div class="list-group-item text-muted">No matches</div>';
      list.classList.remove('d-none');
      return;
    }
    items.slice(0, 40).forEach(function(item) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'list-group-item list-group-item-action';
      button.textContent = item.label;
      button.addEventListener('mousedown', function(event) {
        event.preventDefault();
        onPick(item);
      });
      list.appendChild(button);
    });
    list.classList.remove('d-none');
  }

  function showApartments() {
    const matches = (choices.apartments || []).filter(function(apartment) {
      return matchesApartment(apartment, apartmentInput.value);
    });
    renderResults(apartmentResults, matches, function(apartment) {
      apartmentId.value = String(apartment.id);
      apartmentInput.value = apartment.label;
      hideResults(apartmentResults);
      clearError();
    });
  }

  function personLabel(person) {
    const phone = person.phone ? ' — ' + person.phone : '';
    const email = person.email ? ' (' + person.email + ')' : '';
    return person.name + phone + email;
  }

  function showPeople() {
    const query = normalizeQuery(personInput.value);
    const compactQuery = query.replace(/\s/g, '');
    const matches = (choices.users || []).filter(function(person) {
      if (!query) return true;
      const haystack = normalizeQuery([person.name, person.phone, person.email].join(' '));
      return haystack.indexOf(query) !== -1 || haystack.replace(/\s/g, '').indexOf(compactQuery) !== -1;
    }).map(function(person) {
      return {
        id: person.id,
        name: person.name,
        phone: person.phone,
        email: person.email,
        label: personLabel(person)
      };
    });
    renderResults(personResults, matches, function(person) {
      fillingPerson = true;
      userId.value = String(person.id);
      selectedPhone = person.phone || '';
      personInput.value = person.name;
      nameInput.value = person.name || '';
      phoneInput.value = person.phone || '';
      emailInput.value = person.email || '';
      fillingPerson = false;
      hideResults(personResults);
      clearError();
    });
  }

  function resolveApartment() {
    if (apartmentId.value) return true;
    const query = normalizeQuery(apartmentInput.value);
    if (!query) return false;
    const matches = (choices.apartments || []).filter(function(apartment) {
      return matchesApartment(apartment, query);
    });
    const exact = matches.filter(function(apartment) {
      const code = normalizeQuery(apartment.block + ' ' + apartment.unit);
      const label = normalizeQuery(apartment.label);
      return label === query || code === query || compact(code) === compact(query);
    });
    const chosen = exact.length === 1 ? exact[0] : (matches.length === 1 ? matches[0] : null);
    if (!chosen) return false;
    apartmentId.value = String(chosen.id);
    apartmentInput.value = chosen.label;
    return true;
  }

  apartmentInput.addEventListener('input', function() {
    apartmentId.value = '';
    showApartments();
  });
  apartmentInput.addEventListener('focus', showApartments);
  personInput.addEventListener('input', showPeople);
  personInput.addEventListener('focus', showPeople);
  nameInput.addEventListener('input', function() {
    if (!fillingPerson) {
      userId.value = '';
      selectedPhone = '';
    }
  });
  phoneInput.addEventListener('input', function() {
    if (fillingPerson || !userId.value || !selectedPhone) return;
    const typed = phoneInput.value.replace(/\D/g, '').slice(-6);
    const selected = selectedPhone.replace(/\D/g, '').slice(-6);
    if (typed && selected && typed !== selected) {
      userId.value = '';
      selectedPhone = '';
    }
  });

  document.addEventListener('click', function(event) {
    if (!apartmentInput.contains(event.target) && !apartmentResults.contains(event.target)) {
      hideResults(apartmentResults);
    }
    if (!personInput.contains(event.target) && !personResults.contains(event.target)) {
      hideResults(personResults);
    }
  });

  modalEl.addEventListener('hidden.bs.modal', function() {
    form.reset();
    apartmentId.value = '';
    userId.value = '';
    selectedPhone = '';
    hideResults(apartmentResults);
    hideResults(personResults);
    clearError();
    const submit = form.querySelector('button[type="submit"]');
    if (submit) {
      submit.disabled = false;
      submit.textContent = 'Add Access';
    }
  });

  form.addEventListener('submit', function(event) {
    clearError();
    if (!resolveApartment()) {
      event.preventDefault();
      showError('Select an apartment. Start with the block and number, for example A 12.');
      apartmentInput.focus();
      return;
    }
    if (!nameInput.value.trim() || !phoneInput.value.trim()) {
      event.preventDefault();
      showError('Name and phone are required so this person can be added to the SafeMate app.');
      return;
    }
    const submit = form.querySelector('button[type="submit"]');
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Adding...';
    }
  });
}

function initParkingMapAdmin() {
  var page = document.getElementById('parking-map-admin');
  var dataEl = document.getElementById('parkingMapAdminData');
  if (!page || !dataEl || typeof bootstrap === 'undefined') return;

  var data;
  try {
    data = JSON.parse(dataEl.textContent || '{}');
  } catch (error) {
    return;
  }

  var svg = document.getElementById('parkingMapSvg');
  var stage = document.getElementById('parkingMapStage');
  var viewport = document.getElementById('parkingMapViewport');
  var image = document.getElementById('parkingMapImage');
  var handlesEl = document.getElementById('parkingMapHandles');
  var statusEl = document.getElementById('parkingMapStatus');
  var list = document.getElementById('parkingApartmentList');
  var search = document.getElementById('parkingApartmentSearch');
  var panBtn = document.getElementById('parkingToolPan');
  var drawBtn = document.getElementById('parkingToolDraw');
  var deleteBtn = document.getElementById('parkingDeleteBay');
  var deleteModalEl = document.getElementById('parkingDeleteModal');
  var deleteLabel = document.getElementById('parkingDeleteLabel');
  var deleteConfirm = document.getElementById('parkingDeleteConfirm');
  if (!svg || !stage || !viewport || !image || !handlesEl || !statusEl || !list) return;

  var SVG_NS = 'http://www.w3.org/2000/svg';
  var MIN_EDGE = 0.35;
  var MIN_AREA = 0.05;
  var spots = data.spots || {};
  var csrf = data.csrfToken || '';
  var selectedId = null;
  var selectedBayIndex = null;
  var mode = 'pan';
  var phase = 'idle';
  var view = { scale: 1, tx: 0, ty: 0 };
  var panDrag = null;
  var edgeDrag = null;
  var widthDrag = null;
  var edgeStart = null;
  var edgeEnd = null;
  var widthPoint = null;
  var previewLayer = null;
  var savePromise = Promise.resolve();
  var deleteModal = new bootstrap.Modal(deleteModalEl);

  function norm(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  function cloneBays(bays) {
    return (bays || []).map(function(bay) {
      return { points: bay.points.map(function(point) { return { x: point.x, y: point.y }; }) };
    });
  }

  function clampPoint(point) {
    return {
      x: Math.max(0, Math.min(100, point.x)),
      y: Math.max(0, Math.min(100, point.y))
    };
  }

  function polygonArea(points) {
    var sum = 0;
    for (var i = 0; i < points.length; i += 1) {
      var next = points[(i + 1) % points.length];
      sum += points[i].x * next.y - next.x * points[i].y;
    }
    return Math.abs(sum) / 2;
  }

  function pointInPolygon(point, points) {
    var inside = false;
    for (var i = 0, j = points.length - 1; i < points.length; j = i++) {
      var yi = points[i].y;
      var yj = points[j].y;
      var intersect = ((yi > point.y) !== (yj > point.y)) &&
        (point.x < (points[j].x - points[i].x) * (point.y - yi) / ((yj - yi) || 1e-9) + points[i].x);
      if (intersect) inside = !inside;
    }
    return inside;
  }

  function rotatedRect(a, b, c) {
    var vx = b.x - a.x;
    var vy = b.y - a.y;
    var len = Math.hypot(vx, vy);
    if (len < 0.05) return null;
    var px = -vy / len;
    var py = vx / len;
    var w = (c.x - a.x) * px + (c.y - a.y) * py;
    if (Math.abs(w) < 0.15) return null;
    return [
      clampPoint(a),
      clampPoint(b),
      clampPoint({ x: b.x + px * w, y: b.y + py * w }),
      clampPoint({ x: a.x + px * w, y: a.y + py * w })
    ];
  }

  function pointsAttr(points) {
    return points.map(function(point) { return point.x + ',' + point.y; }).join(' ');
  }

  function capturePointer(el, pointerId) {
    try {
      el.setPointerCapture(pointerId);
    } catch (error) {
      // Some pointer events cannot be captured. The gesture still tracks move and up.
    }
  }

  function setStatus(message, isError) {
    statusEl.textContent = message;
    statusEl.classList.toggle('is-error', !!isError);
  }

  function selectedLabel() {
    var button = list.querySelector('[data-apartment-id="' + selectedId + '"]');
    var span = button ? button.querySelector('span') : null;
    return span ? span.textContent : 'this apartment';
  }

  function updateDeleteButton() {
    deleteBtn.disabled = selectedBayIndex == null;
  }

  function updateCount(id) {
    var el = list.querySelector('[data-count-for="' + id + '"]');
    if (el) el.textContent = String((spots[String(id)] || []).length);
  }

  function clientToPercent(clientX, clientY) {
    var rect = stage.getBoundingClientRect();
    if (!rect.width || !rect.height) return { x: 0, y: 0 };
    return clampPoint({
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100
    });
  }

  function applyView() {
    stage.style.transform = 'translate(' + view.tx + 'px,' + view.ty + 'px) scale(' + view.scale + ')';
    stage.style.setProperty('--map-scale', String(view.scale));
  }

  function stageSize() {
    return { w: stage.offsetWidth, h: stage.offsetHeight };
  }

  function fitPlan() {
    var size = stageSize();
    if (!size.w || !size.h) return;
    var s = Math.min(viewport.clientWidth / size.w, viewport.clientHeight / size.h);
    view.scale = s || 1;
    view.tx = (viewport.clientWidth - size.w * view.scale) / 2;
    view.ty = (viewport.clientHeight - size.h * view.scale) / 2;
    applyView();
  }

  function zoomAt(clientX, clientY, nextScale) {
    var rect = viewport.getBoundingClientRect();
    var mx = clientX - rect.left;
    var my = clientY - rect.top;
    var s1 = Math.max(0.4, Math.min(14, nextScale));
    var sx = (mx - view.tx) / view.scale;
    var sy = (my - view.ty) / view.scale;
    view.scale = s1;
    view.tx = mx - sx * s1;
    view.ty = my - sy * s1;
    applyView();
  }

  function zoomToPoints(points) {
    if (!points.length) return;
    var size = stageSize();
    if (!size.w || !size.h) return;
    var minX = 100;
    var minY = 100;
    var maxX = 0;
    var maxY = 0;
    points.forEach(function(point) {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      maxX = Math.max(maxX, point.x);
      maxY = Math.max(maxY, point.y);
    });
    var padX = Math.max(1.5, (maxX - minX) * 0.45);
    var padY = Math.max(1.5, (maxY - minY) * 0.45);
    minX = Math.max(0, minX - padX);
    minY = Math.max(0, minY - padY);
    maxX = Math.min(100, maxX + padX);
    maxY = Math.min(100, maxY + padY);
    var bw = ((maxX - minX) / 100) * size.w;
    var bh = ((maxY - minY) / 100) * size.h;
    if (bw < 1 || bh < 1) return;
    var s = Math.max(1, Math.min(12, Math.min(viewport.clientWidth / bw, viewport.clientHeight / bh)));
    var cx = ((minX + maxX) / 2 / 100) * size.w;
    var cy = ((minY + maxY) / 2 / 100) * size.h;
    view.scale = s;
    view.tx = viewport.clientWidth / 2 - cx * s;
    view.ty = viewport.clientHeight / 2 - cy * s;
    applyView();
  }

  function hitBay(point) {
    var bays = spots[String(selectedId)] || [];
    for (var i = bays.length - 1; i >= 0; i -= 1) {
      if (pointInPolygon(point, bays[i].points)) return i;
    }
    return -1;
  }

  function addPolygon(apartmentId, bayIndex, points, selected) {
    var polygon = document.createElementNS(SVG_NS, 'polygon');
    polygon.setAttribute('points', pointsAttr(points));
    polygon.setAttribute('data-apartment-id', String(apartmentId));
    polygon.setAttribute('data-bay-index', String(bayIndex));
    var active = selected && bayIndex === selectedBayIndex;
    polygon.setAttribute('fill', selected ? '#c9a227' : '#6d7c8a');
    polygon.setAttribute('fill-opacity', active ? '0.72' : (selected ? '0.5' : '0.28'));
    polygon.setAttribute('stroke', active ? '#5c4308' : (selected ? '#c9a227' : '#4d5966'));
    polygon.setAttribute('stroke-width', active ? '0.28' : '0.12');
    svg.appendChild(polygon);
  }

  function renderPreview() {
    if (!previewLayer) return;
    while (previewLayer.firstChild) previewLayer.removeChild(previewLayer.firstChild);
    if (phase === 'edge' && edgeDrag && edgeEnd) {
      var line = document.createElementNS(SVG_NS, 'line');
      line.setAttribute('x1', String(edgeDrag.start.x));
      line.setAttribute('y1', String(edgeDrag.start.y));
      line.setAttribute('x2', String(edgeEnd.x));
      line.setAttribute('y2', String(edgeEnd.y));
      line.setAttribute('stroke', '#c9a227');
      line.setAttribute('stroke-width', '0.2');
      previewLayer.appendChild(line);
      return;
    }
    if (phase === 'width' && edgeStart && edgeEnd && widthPoint) {
      var rect = rotatedRect(edgeStart, edgeEnd, widthPoint);
      if (!rect) return;
      var polygon = document.createElementNS(SVG_NS, 'polygon');
      polygon.setAttribute('points', pointsAttr(rect));
      polygon.setAttribute('fill', '#c9a227');
      polygon.setAttribute('fill-opacity', '0.35');
      polygon.setAttribute('stroke', '#5c4308');
      polygon.setAttribute('stroke-width', '0.18');
      polygon.setAttribute('stroke-dasharray', '0.45 0.28');
      previewLayer.appendChild(polygon);
    }
  }

  function renderHandles() {
    handlesEl.innerHTML = '';
    if (selectedId == null || selectedBayIndex == null) return;
    var bay = (spots[String(selectedId)] || [])[selectedBayIndex];
    if (!bay) return;
    bay.points.forEach(function(point, index) {
      var handle = document.createElement('button');
      handle.type = 'button';
      handle.className = 'parking-admin__handle';
      handle.style.left = point.x + '%';
      handle.style.top = point.y + '%';
      handle.setAttribute('aria-label', 'Drag corner ' + (index + 1));
      handle.addEventListener('pointerdown', onCornerDown);
      handle.addEventListener('pointermove', onCornerMove);
      handle.addEventListener('pointerup', onCornerUp);
      handle.dataset.pointIndex = String(index);
      handlesEl.appendChild(handle);
    });
  }

  function renderShapes() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    Object.keys(spots).forEach(function(id) {
      if (String(id) === String(selectedId)) return;
      (spots[id] || []).forEach(function(bay, index) {
        addPolygon(id, index, bay.points, false);
      });
    });
    if (selectedId != null) {
      (spots[String(selectedId)] || []).forEach(function(bay, index) {
        addPolygon(selectedId, index, bay.points, true);
      });
    }
    previewLayer = document.createElementNS(SVG_NS, 'g');
    svg.appendChild(previewLayer);
    renderPreview();
    renderHandles();
  }

  function cancelDraft() {
    phase = 'idle';
    edgeDrag = null;
    widthDrag = null;
    edgeStart = null;
    edgeEnd = null;
    widthPoint = null;
    renderPreview();
  }

  function restore(id, previous) {
    if (previous.length) spots[String(id)] = previous;
    else delete spots[String(id)];
  }

  function persist(id, previous) {
    setStatus('Saving…', false);
    savePromise = savePromise.then(function() {
      var payload = cloneBays(spots[String(id)] || []);
      return fetch('/admin/parking-map', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-CSRF-Token': csrf
        },
        body: JSON.stringify({ apartmentId: id, bays: payload, _csrf: csrf })
      }).then(function(res) {
        return res.json().then(function(body) {
          if (!res.ok || !body.success) {
            throw new Error((body && body.message) || 'Could not save the parking bay.');
          }
          var current = JSON.stringify(spots[String(id)] || []);
          if (current === JSON.stringify(payload)) {
            if (body.bays && body.bays.length) spots[String(id)] = body.bays;
            else delete spots[String(id)];
          }
          updateCount(id);
          renderShapes();
          updateDeleteButton();
          setStatus('Saved.', false);
        });
      }).catch(function(error) {
        var current = JSON.stringify(spots[String(id)] || []);
        var payloadJson = JSON.stringify(payload);
        if (current === payloadJson) {
          restore(id, previous);
          if (selectedBayIndex != null && selectedBayIndex >= (spots[String(id)] || []).length) {
            selectedBayIndex = null;
          }
          renderShapes();
          updateCount(id);
          updateDeleteButton();
        }
        setStatus(error.message || 'Could not save the parking bay.', true);
      });
    });
  }

  var cornerDrag = null;
  var cornerSnapshot = null;

  function onCornerDown(event) {
    if (!selectedId || selectedBayIndex == null) return;
    event.preventDefault();
    event.stopPropagation();
    var bay = (spots[String(selectedId)] || [])[selectedBayIndex];
    if (!bay) return;
    cornerSnapshot = cloneBays([bay])[0].points;
    cornerDrag = {
      pointerId: event.pointerId,
      pointIndex: parseInt(event.currentTarget.dataset.pointIndex, 10)
    };
    capturePointer(event.currentTarget, event.pointerId);
  }

  function onCornerMove(event) {
    if (!cornerDrag || cornerDrag.pointerId !== event.pointerId) return;
    var bay = (spots[String(selectedId)] || [])[selectedBayIndex];
    if (!bay) return;
    bay.points[cornerDrag.pointIndex] = clientToPercent(event.clientX, event.clientY);
    var polygon = svg.querySelector('[data-apartment-id="' + selectedId + '"][data-bay-index="' + selectedBayIndex + '"]');
    if (polygon) polygon.setAttribute('points', pointsAttr(bay.points));
    event.currentTarget.style.left = bay.points[cornerDrag.pointIndex].x + '%';
    event.currentTarget.style.top = bay.points[cornerDrag.pointIndex].y + '%';
  }

  function onCornerUp(event) {
    if (!cornerDrag || cornerDrag.pointerId !== event.pointerId) return;
    var bay = (spots[String(selectedId)] || [])[selectedBayIndex];
    var pointIndex = cornerDrag.pointIndex;
    cornerDrag = null;
    if (!bay) return;
    if (polygonArea(bay.points) < MIN_AREA) {
      bay.points = cornerSnapshot;
      renderShapes();
      setStatus('That corner made the bay too small.', true);
      return;
    }
    var previous = cloneBays(spots[String(selectedId)] || []);
    previous[selectedBayIndex] = { points: cornerSnapshot };
    if (pointIndex < 0) return;
    persist(selectedId, previous);
  }

  function commitWidth(point) {
    var rect = rotatedRect(edgeStart, edgeEnd, point);
    if (!rect || polygonArea(rect) < MIN_AREA) {
      setStatus('Move sideways to set the width.', true);
      return;
    }
    var id = selectedId;
    var previous = cloneBays(spots[String(id)] || []);
    var next = previous.concat([{ points: rect }]);
    spots[String(id)] = next;
    selectedBayIndex = next.length - 1;
    phase = 'idle';
    edgeStart = null;
    edgeEnd = null;
    widthPoint = null;
    renderShapes();
    updateDeleteButton();
    persist(id, previous);
  }

  function onPointerDown(event) {
    if (event.button !== 0) return;
    if (event.target.closest && event.target.closest('.parking-admin__handle')) return;
    var point = clientToPercent(event.clientX, event.clientY);

    if (mode === 'pan' && phase === 'idle') {
      panDrag = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        tx: view.tx,
        ty: view.ty,
        moved: false,
        hit: hitBay(point)
      };
      viewport.classList.add('is-panning');
      capturePointer(viewport, event.pointerId);
      return;
    }

    if (mode !== 'draw') return;
    if (!selectedId) {
      setStatus('Select an apartment.', true);
      return;
    }

    if (phase === 'width') {
      widthDrag = { pointerId: event.pointerId };
      widthPoint = point;
      renderPreview();
      capturePointer(viewport, event.pointerId);
      return;
    }

    if (phase !== 'idle') return;
    var hit = hitBay(point);
    if (hit >= 0) {
      selectedBayIndex = hit;
      renderShapes();
      updateDeleteButton();
      setStatus('Drag a corner to adjust this bay, or draw another one.', false);
      return;
    }

    phase = 'edge';
    edgeDrag = { pointerId: event.pointerId, start: point };
    edgeEnd = point;
    selectedBayIndex = null;
    updateDeleteButton();
    renderShapes();
    capturePointer(viewport, event.pointerId);
    setStatus('Release to set that side.', false);
  }

  function onPointerMove(event) {
    if (panDrag && panDrag.pointerId === event.pointerId) {
      var dx = event.clientX - panDrag.x;
      var dy = event.clientY - panDrag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) panDrag.moved = true;
      view.tx = panDrag.tx + dx;
      view.ty = panDrag.ty + dy;
      applyView();
      return;
    }
    var point = clientToPercent(event.clientX, event.clientY);
    if (phase === 'edge' && edgeDrag && edgeDrag.pointerId === event.pointerId) {
      edgeEnd = point;
      renderPreview();
      return;
    }
    if (phase === 'width' && (!widthDrag || widthDrag.pointerId === event.pointerId)) {
      widthPoint = point;
      renderPreview();
    }
  }

  function onPointerUp(event) {
    if (panDrag && panDrag.pointerId === event.pointerId) {
      var hit = panDrag.hit;
      var moved = panDrag.moved;
      panDrag = null;
      viewport.classList.remove('is-panning');
      if (!moved && hit >= 0) {
        selectedBayIndex = hit;
        renderShapes();
        updateDeleteButton();
        setStatus('Drag a corner to adjust this bay, or switch to Draw.', false);
      }
      return;
    }
    if (phase === 'edge' && edgeDrag && edgeDrag.pointerId === event.pointerId) {
      var end = clientToPercent(event.clientX, event.clientY);
      var start = edgeDrag.start;
      edgeDrag = null;
      if (Math.hypot(end.x - start.x, end.y - start.y) < MIN_EDGE) {
        phase = 'idle';
        edgeEnd = null;
        renderPreview();
        setStatus('Drag a longer side of the stall.', true);
        return;
      }
      phase = 'width';
      edgeStart = start;
      edgeEnd = end;
      widthPoint = end;
      renderPreview();
      setStatus('Move sideways, then click to set the width.', false);
      return;
    }
    if (phase === 'width' && widthDrag && widthDrag.pointerId === event.pointerId) {
      widthDrag = null;
      commitWidth(clientToPercent(event.clientX, event.clientY));
    }
  }

  function setMode(next) {
    cancelDraft();
    mode = next;
    var drawing = mode === 'draw';
    panBtn.classList.toggle('btn-primary', !drawing);
    panBtn.classList.toggle('btn-outline-secondary', drawing);
    panBtn.setAttribute('aria-pressed', drawing ? 'false' : 'true');
    drawBtn.classList.toggle('btn-primary', drawing);
    drawBtn.classList.toggle('btn-outline-secondary', !drawing);
    drawBtn.setAttribute('aria-pressed', drawing ? 'true' : 'false');
    viewport.classList.toggle('is-draw', drawing);
    viewport.classList.toggle('is-pan', !drawing);
    if (drawing) {
      setStatus(selectedId ? 'Drag along one side of the stall.' : 'Select an apartment.', !selectedId);
    } else {
      setStatus(selectedId ? 'Drag to move the plan.' : 'Select an apartment.', false);
    }
  }

  function selectApartment(id) {
    cancelDraft();
    selectedId = id;
    selectedBayIndex = null;
    list.querySelectorAll('.parking-admin__apt').forEach(function(button) {
      button.classList.toggle('is-active', button.getAttribute('data-apartment-id') === String(id));
    });
    renderShapes();
    updateDeleteButton();
    var points = [];
    (spots[String(id)] || []).forEach(function(bay) {
      bay.points.forEach(function(point) { points.push(point); });
    });
    if (points.length) zoomToPoints(points);
    if (mode === 'draw') setStatus('Drag along one side of the stall.', false);
    else setStatus('Pan is on. Switch to Draw to place a bay for ' + selectedLabel() + '.', false);
  }

  list.querySelectorAll('.parking-admin__apt').forEach(function(button) {
    button.addEventListener('click', function() {
      selectApartment(parseInt(button.getAttribute('data-apartment-id'), 10));
    });
  });

  if (search) {
    search.addEventListener('input', function() {
      var query = norm(search.value);
      list.querySelectorAll('.parking-admin__apt').forEach(function(button) {
        var hay = norm(button.getAttribute('data-search') || '');
        button.hidden = !!query && hay.indexOf(query) === -1;
      });
    });
  }

  panBtn.addEventListener('click', function() { setMode('pan'); });
  drawBtn.addEventListener('click', function() { setMode('draw'); });
  document.getElementById('parkingZoomIn').addEventListener('click', function() {
    var rect = viewport.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, view.scale * 1.25);
  });
  document.getElementById('parkingZoomOut').addEventListener('click', function() {
    var rect = viewport.getBoundingClientRect();
    zoomAt(rect.left + rect.width / 2, rect.top + rect.height / 2, view.scale / 1.25);
  });
  document.getElementById('parkingFit').addEventListener('click', fitPlan);

  deleteBtn.addEventListener('click', function() {
    if (selectedBayIndex == null || !selectedId) return;
    deleteLabel.textContent = selectedLabel();
    deleteModal.show();
  });

  deleteConfirm.addEventListener('click', function() {
    if (selectedBayIndex == null || !selectedId) return;
    var id = selectedId;
    var index = selectedBayIndex;
    var previous = cloneBays(spots[String(id)] || []);
    var next = previous.filter(function(_, i) { return i !== index; });
    if (next.length) spots[String(id)] = next;
    else delete spots[String(id)];
    selectedBayIndex = null;
    deleteModal.hide();
    renderShapes();
    updateDeleteButton();
    persist(id, previous);
  });

  viewport.addEventListener('pointerdown', onPointerDown);
  viewport.addEventListener('pointermove', onPointerMove);
  viewport.addEventListener('pointerup', onPointerUp);
  viewport.addEventListener('pointercancel', onPointerUp);
  viewport.addEventListener('wheel', function(event) {
    event.preventDefault();
    var factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    zoomAt(event.clientX, event.clientY, view.scale * factor);
  }, { passive: false });

  document.addEventListener('keydown', function(event) {
    if (event.key !== 'Escape' || phase === 'idle') return;
    cancelDraft();
    setStatus(mode === 'draw' ? 'Drag along one side of the stall.' : 'Drag to move the plan.', false);
  });

  function start() {
    renderShapes();
    fitPlan();
  }

  if (image.complete && image.naturalWidth) start();
  else image.addEventListener('load', start);
}

document.addEventListener('DOMContentLoaded', initParkingMapAdmin); 