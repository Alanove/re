/**
 * Modern Contact Page JavaScript
 * Enhanced functionality for the modern contact page layout
 */
class ModernContactPage {
  constructor() {
    this.init();
  }

  init() {
    this.setupMapInteractions();
    this.setupContactForm();
    this.setupAnimations();
    this.setupScrollEffects();
  }

  // Setup map interactions for the modern layout
  setupMapInteractions() {
    const mapPins = document.querySelectorAll('.map-pin');
    const infoCards = document.querySelectorAll('.info-card');

    // Handle map pin clicks
    mapPins.forEach(pin => {
      const office = pin.dataset.office;
      
      pin.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchOffice(office);
      });

      // Add hover effects
      pin.addEventListener('mouseenter', () => {
        this.highlightOffice(office);
      });

      pin.addEventListener('mouseleave', () => {
        this.removeHighlight();
      });
    });

    // Handle info card clicks
    infoCards.forEach(card => {
      const office = card.dataset.office;
      
      card.addEventListener('click', () => {
        this.switchOffice(office);
      });
    });
  }

  // Switch active office
  switchOffice(office) {
    // Update info cards
    document.querySelectorAll('.info-card').forEach(card => {
      card.classList.remove('active');
    });
    
    const targetCard = document.querySelector(`[data-office="${office}"]`);
    if (targetCard) {
      targetCard.classList.add('active');
    }

    // Animate map pins
    document.querySelectorAll('.map-pin').forEach(pin => {
      pin.classList.remove('active');
    });
    
    const targetPin = document.querySelector(`.map-pin[data-office="${office}"]`);
    if (targetPin) {
      targetPin.classList.add('active');
      this.animatePin(targetPin);
    }

    // Get office information
    this.showOfficeDetails(office);
  }

  // Highlight office on hover
  highlightOffice(office) {
    const pin = document.querySelector(`.map-pin[data-office="${office}"]`);
    const card = document.querySelector(`.info-card[data-office="${office}"]`);
    
    if (pin) pin.classList.add('highlighted');
    if (card) card.classList.add('highlighted');
  }

  // Remove highlight
  removeHighlight() {
    document.querySelectorAll('.map-pin, .info-card').forEach(element => {
      element.classList.remove('highlighted');
    });
  }

  // Animate map pin
  animatePin(pin) {
    pin.style.transform = 'scale(1.2)';
    setTimeout(() => {
      pin.style.transform = 'scale(1)';
    }, 300);
  }

  // Show office details
  showOfficeDetails(office) {
    const offices = {
      lebanon: {
        name: 'Lebanon Office',
        address: 'Al Moudir Center, Jal el Dib, El Metn, Lebanon',
        phones: ['+961 4 710 253', '+961 4 719 253'],
        mapUrl: 'https://maps.google.com/?q=Al+Moudir+Center,+Jal+el+Dib,+El+Metn,+Lebanon',
        timezone: 'GMT+2',
        hours: '8:00 AM - 6:00 PM'
      },
      dubai: {
        name: 'Dubai Office',
        address: 'Dubai Silicon Oasis, Dubai Digital Park, Building A2, Dubai, UAE',
        phones: ['+971 54 421 1769'],
        mapUrl: 'https://maps.google.com/?q=Dubai+Silicon+Oasis,+Dubai+Digital+Park,+Building+A2,+Dubai,+United+Arab+Emirates',
        timezone: 'GMT+4',
        hours: '9:00 AM - 7:00 PM'
      }
    };

    const officeData = offices[office];
    if (officeData) {
      console.log(`Selected office: ${officeData.name}`);
      // You can add a notification or modal here if needed
    }
  }

  // Setup enhanced contact form
  setupContactForm() {
    const form = document.getElementById('contactForm');
    const submitBtn = form?.querySelector('.btn-submit-modern');
    
    if (!form) return;

    // Add form validation
    this.setupFormValidation(form);

    // Handle form submission
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      if (this.validateForm(form)) {
        await this.submitForm(form, submitBtn);
      }
    });

    // Add real-time validation
    const fields = form.querySelectorAll('input, textarea, select');
    fields.forEach(field => {
      field.addEventListener('blur', () => {
        this.validateField(field);
      });

      field.addEventListener('input', () => {
        this.clearFieldError(field);
      });
    });
  }

  // Setup form validation
  setupFormValidation(form) {
    const requiredFields = form.querySelectorAll('[required]');
    
    requiredFields.forEach(field => {
      const fieldContainer = field.closest('.form-field');
      if (fieldContainer && !fieldContainer.querySelector('.error-message')) {
        const errorMsg = document.createElement('div');
        errorMsg.className = 'error-message';
        fieldContainer.appendChild(errorMsg);
      }
    });
  }

  // Validate entire form
  validateForm(form) {
    let isValid = true;
    const fields = form.querySelectorAll('[required]');
    
    fields.forEach(field => {
      if (!this.validateField(field)) {
        isValid = false;
      }
    });

    // Email validation
    const emailField = form.querySelector('[type="email"]');
    if (emailField && emailField.value && !this.isValidEmail(emailField.value)) {
      this.showFieldError(emailField, 'Please enter a valid email address');
      isValid = false;
    }

    // Phone validation (if provided)
    const phoneField = form.querySelector('[type="tel"]');
    if (phoneField && phoneField.value && !this.isValidPhone(phoneField.value)) {
      this.showFieldError(phoneField, 'Please enter a valid phone number');
      isValid = false;
    }

    return isValid;
  }

  // Validate individual field
  validateField(field) {
    const value = field.value.trim();
    
    if (field.hasAttribute('required') && !value) {
      this.showFieldError(field, 'This field is required');
      return false;
    }

    if (field.type === 'email' && value && !this.isValidEmail(value)) {
      this.showFieldError(field, 'Please enter a valid email address');
      return false;
    }

    if (field.type === 'tel' && value && !this.isValidPhone(value)) {
      this.showFieldError(field, 'Please enter a valid phone number');
      return false;
    }

    this.clearFieldError(field);
    return true;
  }

  // Show field error
  showFieldError(field, message) {
    const fieldContainer = field.closest('.form-field');
    const errorElement = fieldContainer?.querySelector('.error-message');
    
    if (errorElement) {
      errorElement.textContent = message;
      errorElement.style.display = 'block';
    }
    
    fieldContainer?.classList.add('has-error');
    field.classList.add('error');
  }

  // Clear field error
  clearFieldError(field) {
    const fieldContainer = field.closest('.form-field');
    const errorElement = fieldContainer?.querySelector('.error-message');
    
    if (errorElement) {
      errorElement.style.display = 'none';
    }
    
    fieldContainer?.classList.remove('has-error');
    field.classList.remove('error');
  }

  // Email validation
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Phone validation
  isValidPhone(phone) {
    const phoneRegex = /^[\+]?[1-9][\d]{0,15}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  // Submit form
  async submitForm(form, submitBtn) {
    try {
      // Show loading state
      submitBtn.classList.add('loading');
      submitBtn.disabled = true;

      // Simulate form submission (replace with actual endpoint)
      await this.simulateFormSubmission(new FormData(form));

      // Show success message
      this.showSuccessMessage('Thank you! Your message has been sent successfully. We\'ll get back to you soon.');
      
      // Reset form
      form.reset();

    } catch (error) {
      console.error('Form submission error:', error);
      this.showErrorMessage('Sorry, there was an error sending your message. Please try again.');
    } finally {
      // Remove loading state
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  }

  // Simulate form submission (replace with actual API call)
  async simulateFormSubmission(formData) {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('Form data:', Object.fromEntries(formData));
        resolve();
      }, 2000);
    });
  }

  // Show success message
  showSuccessMessage(message) {
    this.showNotification(message, 'success');
  }

  // Show error message
  showErrorMessage(message) {
    this.showNotification(message, 'error');
  }

  // Show notification
  showNotification(message, type) {
    // Remove existing notifications
    document.querySelectorAll('.notification').forEach(n => n.remove());

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
      <div class="notification-content">
        <div class="notification-icon">
          ${type === 'success' ? '✓' : '⚠'}
        </div>
        <div class="notification-message">${message}</div>
        <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    // Add styles
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 1000;
      max-width: 400px;
      background: ${type === 'success' ? '#22c55e' : '#ef4444'};
      color: white;
      border-radius: 12px;
      padding: 1rem;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      transform: translateX(100%);
      transition: transform 0.3s ease;
    `;

    notification.querySelector('.notification-content').style.cssText = `
      display: flex;
      align-items: center;
      gap: 1rem;
    `;

    notification.querySelector('.notification-close').style.cssText = `
      background: none;
      border: none;
      color: white;
      font-size: 1.5rem;
      cursor: pointer;
      margin-left: auto;
    `;

    document.body.appendChild(notification);

    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 100);

    // Auto remove after 5 seconds
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => notification.remove(), 300);
    }, 5000);
  }

  // Setup scroll animations
  setupScrollEffects() {
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        }
      });
    }, observerOptions);

    // Observe elements for animation
    document.querySelectorAll('.office-card-modern, .form-field, .info-card').forEach(el => {
      observer.observe(el);
    });
  }

  // Setup page animations
  setupAnimations() {
    // Add CSS for animations
    const style = document.createElement('style');
    style.textContent = `
      .office-card-modern,
      .form-field,
      .info-card {
        opacity: 0;
        transform: translateY(30px);
        transition: all 0.6s ease;
      }

      .animate-in {
        opacity: 1 !important;
        transform: translateY(0) !important;
      }

      .map-pin.highlighted {
        transform: scale(1.1);
      }

      .info-card.highlighted {
        background: var(--background-light);
        transform: translateY(-2px);
      }

      .form-field.has-error input,
      .form-field.has-error textarea,
      .form-field.has-error select {
        border-bottom-color: #ef4444;
      }

      .form-field.has-error .field-line {
        background: #ef4444;
      }

      .error-message {
        color: #ef4444;
        font-size: 0.875rem;
        margin-top: 0.5rem;
        display: none;
      }

      .form-field input.error,
      .form-field textarea.error,
      .form-field select.error {
        border-bottom-color: #ef4444;
      }
    `;
    document.head.appendChild(style);

    // Trigger initial animations
    setTimeout(() => {
      this.setupScrollEffects();
    }, 100);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ModernContactPage();
});

// Backward compatibility with existing code
class ContactPage extends ModernContactPage {
  constructor() {
    super();
  }
}

// Export for potential module use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ModernContactPage, ContactPage };
}
        address: 'Dubai Silicon Oasis, Dubai Digital Park, Building A2, Dubai, United Arab Emirates',
        phone: '+971 54 421 1769',
        mapUrl: 'https://maps.google.com/?q=Dubai+Silicon+Oasis,+Dubai+Digital+Park,+Building+A2,+Dubai,+United+Arab+Emirates'
      }
    };

    const locationData = locations[location];
    if (locationData) {
      // Show location info modal or tooltip
      this.showLocationModal(locationData);
    }
  }

  // Show pointer information
  showPointerInfo(pointer, location) {
    const label = pointer.querySelector('.pointer-label');
    if (label) {
      label.style.opacity = '1';
      label.style.visibility = 'visible';
      label.style.transform = 'translateX(-50%) translateY(-5px)';
    }
  }

  // Hide pointer information
  hidePointerInfo(pointer) {
    const label = pointer.querySelector('.pointer-label');
    if (label) {
      label.style.opacity = '0';
      label.style.visibility = 'hidden';
      label.style.transform = 'translateX(-50%)';
    }
  }

  // Show location modal
  showLocationModal(locationData) {
    // Create modal HTML
    const modalHTML = `
      <div class="location-modal" id="locationModal">
        <div class="modal-overlay"></div>
        <div class="modal-content">
          <div class="modal-header">
            <h3>${locationData.name}</h3>
            <button class="modal-close" onclick="this.closest('.location-modal').remove()">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </button>
          </div>
          <div class="modal-body">
            <div class="location-details">
              <div class="detail-item">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" fill="currentColor"/>
                </svg>
                <span>${locationData.address}</span>
              </div>
              <div class="detail-item">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" fill="currentColor"/>
                </svg>
                <a href="tel:${locationData.phone.replace(/\s/g, '')}">${locationData.phone}</a>
              </div>
            </div>
            <div class="modal-actions">
              <a href="${locationData.mapUrl}" target="_blank" class="btn-directions">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2L13.09 8.26L22 9L13.09 9.74L12 16L10.91 9.74L2 9L10.91 8.26L12 2Z" fill="currentColor"/>
                </svg>
                Get Directions
              </a>
            </div>
          </div>
        </div>
      </div>
    `;

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Add modal styles
    this.addModalStyles();
    
    // Show modal with animation
    setTimeout(() => {
      const modal = document.getElementById('locationModal');
      if (modal) {
        modal.classList.add('show');
      }
    }, 10);
  }

  // Add modal styles
  addModalStyles() {
    if (!document.getElementById('locationModalStyles')) {
      const styles = `
        <style id="locationModalStyles">
          .location-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 1000;
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0;
            visibility: hidden;
            transition: all 0.3s ease;
          }
          
          .location-modal.show {
            opacity: 1;
            visibility: visible;
          }
          
          .modal-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            backdrop-filter: blur(4px);
          }
          
          .modal-content {
            position: relative;
            background: white;
            border-radius: 16px;
            padding: 0;
            max-width: 500px;
            width: 90%;
            max-height: 90vh;
            overflow: hidden;
            transform: scale(0.9);
            transition: transform 0.3s ease;
          }
          
          .location-modal.show .modal-content {
            transform: scale(1);
          }
          
          .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 24px;
            border-bottom: 1px solid #e5e7eb;
          }
          
          .modal-header h3 {
            margin: 0;
            font-size: 1.5rem;
            font-weight: 600;
            color: #22223b;
          }
          
          .modal-close {
            background: none;
            border: none;
            cursor: pointer;
            padding: 8px;
            border-radius: 8px;
            color: #6b7280;
            transition: all 0.3s ease;
          }
          
          .modal-close:hover {
            background: #f3f4f6;
            color: #374151;
          }
          
          .modal-body {
            padding: 24px;
          }
          
          .location-details {
            margin-bottom: 24px;
          }
          
          .detail-item {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 16px;
            color: #374151;
          }
          
          .detail-item svg {
            color: #9a8c98;
            flex-shrink: 0;
          }
          
          .detail-item a {
            color: #22223b;
            text-decoration: none;
            font-weight: 500;
          }
          
          .detail-item a:hover {
            color: #9a8c98;
          }
          
          .modal-actions {
            text-align: center;
          }
          
          .btn-directions {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: linear-gradient(135deg, #22223b, #4a4e69);
            color: white;
            padding: 12px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-weight: 500;
            font-size: 0.9rem;
            transition: all 0.3s ease;
            box-shadow: 0 4px 16px rgba(34, 34, 59, 0.2);
          }
          
          .btn-directions:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 24px rgba(34, 34, 59, 0.3);
            color: white;
          }
        </style>
      `;
      document.head.insertAdjacentHTML('beforeend', styles);
    }
  }

  // Setup contact form
  setupContactForm() {
    const form = document.querySelector('.contact-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleFormSubmit(form);
      });
    }
  }

  // Handle form submission
  handleFormSubmit(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData);
    
    // Basic validation
    if (!data.name || !data.email || !data.message) {
      this.showFormMessage('Please fill in all required fields.', 'error');
      return;
    }
    
    if (!this.isValidEmail(data.email)) {
      this.showFormMessage('Please enter a valid email address.', 'error');
      return;
    }
    
    // Show loading state
    const submitBtn = form.querySelector('.btn-submit');
    const originalText = submitBtn.innerHTML;
    submitBtn.innerHTML = '<svg class="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2v4m0 12v4m4-8h4m-12 0H2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg> Sending...';
    submitBtn.disabled = true;
    
    // Simulate form submission (replace with actual API call)
    setTimeout(() => {
      this.showFormMessage('Thank you for your message! We will get back to you soon.', 'success');
      form.reset();
      submitBtn.innerHTML = originalText;
      submitBtn.disabled = false;
    }, 2000);
  }

  // Show form message
  showFormMessage(message, type) {
    // Remove existing messages
    const existingMessage = document.querySelector('.form-message');
    if (existingMessage) {
      existingMessage.remove();
    }
    
    // Create message element
    const messageEl = document.createElement('div');
    messageEl.className = `form-message ${type}`;
    messageEl.textContent = message;
    
    // Add message styles
    this.addFormMessageStyles();
    
    // Insert message
    const form = document.querySelector('.contact-form');
    if (form) {
      form.insertBefore(messageEl, form.firstChild);
      
      // Auto-remove after 5 seconds
      setTimeout(() => {
        if (messageEl.parentNode) {
          messageEl.remove();
        }
      }, 5000);
    }
  }

  // Add form message styles
  addFormMessageStyles() {
    if (!document.getElementById('formMessageStyles')) {
      const styles = `
        <style id="formMessageStyles">
          .form-message {
            padding: 16px;
            border-radius: 8px;
            margin-bottom: 20px;
            font-weight: 500;
          }
          
          .form-message.success {
            background: rgba(34, 197, 94, 0.1);
            border: 1px solid rgba(34, 197, 94, 0.2);
            color: #166534;
          }
          
          .form-message.error {
            background: rgba(239, 68, 68, 0.1);
            border: 1px solid rgba(239, 68, 68, 0.2);
            color: #991b1b;
          }
          
          .animate-spin {
            animation: spin 1s linear infinite;
          }
          
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        </style>
      `;
      document.head.insertAdjacentHTML('beforeend', styles);
    }
  }

  // Email validation
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Setup animations
  setupAnimations() {
    // Animate elements on scroll
    const observerOptions = {
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('animate-in');
        }
      });
    }, observerOptions);
    
    // Observe elements
    const animateElements = document.querySelectorAll('.office-card, .contact-form, .map-container');
    animateElements.forEach(el => {
      observer.observe(el);
    });
  }
}

// Initialize contact page when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new ContactPage();
});

// Export for modular usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ContactPage;
}
