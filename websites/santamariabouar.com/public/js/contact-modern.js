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
