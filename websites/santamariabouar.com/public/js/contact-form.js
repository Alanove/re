(function () {
  'use strict';

  var form = document.getElementById('contactForm');
  if (!form) return;

  var subjectSelect = document.getElementById('subject');
  var submitBtn = document.getElementById('contactSubmitBtn');
  var submitText = submitBtn ? submitBtn.querySelector('.contact-page__submit-text') : null;
  var submitSpinner = document.getElementById('contactSubmitSpinner');

  var panels = {
    'apartment-inquiry': document.getElementById('fieldApartment'),
    'event-noise-notice': document.getElementById('fieldEvent'),
    'work-execution': document.getElementById('fieldWork'),
    'pool-reservation': document.getElementById('fieldPool')
  };

  var requiredBySubject = {
    'apartment-inquiry': ['apartment'],
    'work-execution': ['workType', 'workFrom', 'workTo', 'mapPicture'],
    'pool-reservation': ['poolDate', 'poolTime']
  };

  var messageEl = document.getElementById('message');
  var apartmentSelect = document.getElementById('apartment');
  var lastAutoMessage = '';

  function hideAllPanels() {
    Object.keys(panels).forEach(function (key) {
      if (panels[key]) panels[key].hidden = true;
    });
  }

  function clearConditionalValidation() {
    ['apartment', 'workType', 'workFrom', 'workTo', 'mapPicture', 'poolDate', 'poolTime'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.removeAttribute('required');
    });
  }

  function selectedApartmentLabel() {
    if (!apartmentSelect || !apartmentSelect.value) return '';
    var option = apartmentSelect.options[apartmentSelect.selectedIndex];
    return option ? option.text : '';
  }

  function maybePrefillMessage() {
    if (!messageEl || !apartmentSelect || !apartmentSelect.value) return;
    var label = selectedApartmentLabel();
    if (!label) return;
    var nextMessage = 'I would like to inquire about apartment: ' + label + '.';
    if (!messageEl.value || messageEl.value === lastAutoMessage) {
      messageEl.value = nextMessage;
      lastAutoMessage = nextMessage;
    }
  }

  function updateSubjectFields() {
    var subject = subjectSelect ? subjectSelect.value : '';
    hideAllPanels();
    clearConditionalValidation();

    if (panels[subject]) {
      panels[subject].hidden = false;
    }

    var requiredFields = requiredBySubject[subject] || [];
    requiredFields.forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.setAttribute('required', 'required');
    });

    if (subject === 'apartment-inquiry') {
      maybePrefillMessage();
    }
  }

  function setSubmitting(isSubmitting) {
    if (!submitBtn) return;
    submitBtn.disabled = isSubmitting;
    if (submitText) submitText.hidden = isSubmitting;
    if (submitSpinner) submitSpinner.hidden = !isSubmitting;
  }

  function showModal(id) {
    var el = document.getElementById(id);
    if (!el || typeof bootstrap === 'undefined') return;
    bootstrap.Modal.getOrCreateInstance(el).show();
  }

  function showError(message) {
    var messageEl = document.getElementById('contactErrorMessage');
    if (messageEl) messageEl.textContent = message || 'Something went wrong. Please try again.';
    showModal('contactErrorModal');
  }

  function validateForm() {
    if (!form.checkValidity()) {
      form.reportValidity();
      return false;
    }
    return true;
  }

  if (apartmentSelect) {
    apartmentSelect.addEventListener('change', function () {
      if (subjectSelect && subjectSelect.value === 'apartment-inquiry') {
        maybePrefillMessage();
      }
    });
  }

  if (subjectSelect) {
    subjectSelect.addEventListener('change', updateSubjectFields);
    updateSubjectFields();
  }

  if (new URLSearchParams(window.location.search).get('success') === '1') {
    showModal('contactSuccessModal');
    if (window.history.replaceState) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    if (!validateForm()) return;

    setSubmitting(true);

    var tokenPromise =
      typeof window.executeInvisibleRecaptcha === 'function'
        ? window.executeInvisibleRecaptcha()
        : Promise.resolve('');

    tokenPromise
      .then(function (token) {
        var formData = new FormData(form);
        if (token) {
          formData.set('g-recaptcha-response', token);
        }

        return fetch('/contact', {
          method: 'POST',
          body: formData,
          headers: {
            Accept: 'application/json'
          }
        });
      })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, data: data };
        });
      })
      .then(function (result) {
        setSubmitting(false);
        if (result.ok && result.data.success) {
          form.reset();
          updateSubjectFields();
          showModal('contactSuccessModal');
          return;
        }
        showError(result.data && result.data.message ? result.data.message : 'Could not send your message.');
      })
      .catch(function () {
        setSubmitting(false);
        showError('Could not send your message. Please check your connection and try again.');
      });
  });
})();
