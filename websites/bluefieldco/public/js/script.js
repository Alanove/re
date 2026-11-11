/* BlueField public site — built by src/scripts/build-script.js */
(function() { "use strict";

/* --- cookie-consent.js --- */

window.addEventListener('load', function () {
  if (typeof window.cookieconsent === 'undefined') return;
  window.cookieconsent.initialise({
    palette: {
      popup: { background: '#11409b', text: '#ffffff' },
      button: { background: '#f97c4b', text: '#ffffff' }
    },
    content: {
      message: 'In order to give you the best user experience, we use cookies on our website.',
      dismiss: 'Continue',
      link: 'More Information',
      href: '/privacy-policy'
    }
  });
});


/* --- header-search.js --- */

document.addEventListener('DOMContentLoaded', function () {
  var searchIcon = document.querySelector('.tm-search-icon.search');
  var searchWrapping = document.querySelector('.search_wrapping');
  var searchForm = document.querySelector('.searching_form');
  var closeSearch = document.querySelector('.close_search');

  if (searchIcon && searchForm) {
    searchIcon.addEventListener('click', function () {
      searchForm.classList.toggle('show');
      if (searchWrapping) searchWrapping.classList.toggle('show');
    });
  }
  if (closeSearch) {
    closeSearch.addEventListener('click', function () {
      searchForm.classList.toggle('show');
      if (searchWrapping) searchWrapping.classList.toggle('show');
    });
  }

  var submit = document.querySelector('.search-submit');
  if (submit) submit.value = '';
});


/* --- home-slider.js --- */

jQuery(document).ready(function ($) {
  if ($('.homeslider').length && typeof $.fn.slick === 'function') {
    $('.homeslider').slick({
      dots: true,
      infinite: true,
      speed: 500,
      fade: true,
      cssEase: 'linear',
      autoplay: true,
      autoplaySpeed: 5000,
      arrows: true
    });
  }
});


/* --- contact-map.js --- */

jQuery(document).ready(function ($) {
  function showPin(pinSelector, contentSelector, textSelector) {
    $(pinSelector).parent().addClass('clicked').siblings().removeClass('clicked');
    $(pinSelector).parent().siblings().find('.pin-text').hide();
    $(contentSelector).siblings('.pin-content').hide().css('opacity', '0');
    $(contentSelector).show().fadeIn(300).css('opacity', '1');
    if (textSelector) $(textSelector).show().fadeIn(300);
  }

  $('.pin-1 .round-pin').on('click', function () {
    showPin('.pin-1 .round-pin', '.pin-content.pin-1-content', '.pin1-text');
  });
  $('.pin-2 .round-pin').on('click', function () {
    showPin('.pin-2 .round-pin', '.pin-content.pin-2-content', '.pin2-text');
  });
  $('.pin-3 .round-pin').on('click', function () {
    showPin('.pin-3 .round-pin', '.pin-content.pin-3-content', '.pin3-text');
  });
  $('.pin-4 .round-pin').on('click', function () {
    showPin('.pin-4 .round-pin', '.pin-content.pin-4-content', '.pin4-text');
  });
});


/* --- forms.js --- */

/**
 * Contact and careers form submissions (homepage CMS forms + /contact page).
 */
(function () {
  'use strict';

  function getFormType(form) {
    if (form.id === 'contactForm') {
      return 'contact';
    }
    if (form.closest('section.careers')) {
      return 'careers';
    }
    if (
      form.enctype === 'multipart/form-data' ||
      form.querySelector('input[type="file"][name="your-file"]')
    ) {
      return 'careers';
    }
    if (form.closest('#submit_your_inquiry')) {
      return 'contact';
    }
    return 'contact';
  }

  function getEndpoint(formType) {
    return formType === 'careers' ? '/api/forms/careers' : '/api/forms/contact';
  }

  function getResponseOutput(form) {
    var existing = form.querySelector('.wpcf7-response-output');
    if (existing) {
      return existing;
    }
    var output = document.createElement('div');
    output.className = 'wpcf7-response-output form-response-output';
    output.setAttribute('aria-hidden', 'true');
    form.appendChild(output);
    return output;
  }

  function setFormStatus(form, status, message) {
    form.setAttribute('data-status', status);
    form.classList.remove('sent', 'failed', 'submitting', 'invalid');
    form.classList.add(status);

    var output = getResponseOutput(form);
    output.textContent = message || '';
    output.setAttribute('aria-hidden', message ? 'false' : 'true');
    output.style.display = message ? 'block' : '';
  }

  function setSubmitting(form, submitting) {
    var btn = form.querySelector('[type="submit"]');
    if (btn) {
      btn.disabled = submitting;
    }
    if (submitting) {
      setFormStatus(form, 'submitting', 'Sending…');
    }
  }

  function collectContactPayload(form) {
    var get = function (name) {
      var el = form.querySelector('[name="' + name + '"]');
      return el && 'value' in el ? String(el.value).trim() : '';
    };

    var source = 'website';
    if (form.id === 'contactForm') {
      source = 'contact page';
    } else if (form.closest('#submit_your_inquiry')) {
      source = 'homepage inquiry';
    }

    return {
      fname: get('fname'),
      lname: get('lname'),
      name: get('name'),
      email: get('email'),
      phone: get('phone'),
      message: get('message'),
      source: source
    };
  }

  function validateContactPayload(payload) {
    var name =
      payload.name ||
      [payload.fname, payload.lname].filter(Boolean).join(' ').trim();
    if (!name) {
      return 'Please enter your name.';
    }
    if (!payload.email) {
      return 'Please enter your email address.';
    }
    if (!payload.message) {
      return 'Please enter your message.';
    }
    if (payload.fname && !payload.phone) {
      return 'Please enter your phone number.';
    }
    return null;
  }

  function submitContactForm(form) {
    var payload = collectContactPayload(form);
    var validationError = validateContactPayload(payload);
    if (validationError) {
      setFormStatus(form, 'invalid', validationError);
      return;
    }

    setSubmitting(form, true);

    fetch('/api/forms/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        setSubmitting(form, false);
        if (result.ok && result.data.success) {
          setFormStatus(form, 'sent', result.data.message);
          form.reset();
        } else {
          setFormStatus(
            form,
            'failed',
            (result.data && result.data.message) ||
              'Something went wrong. Please try again.'
          );
        }
      })
      .catch(function () {
        setSubmitting(form, false);
        setFormStatus(
          form,
          'failed',
          'Network error. Please check your connection and try again.'
        );
      });
  }

  function submitCareersForm(form) {
    var fileInput = form.querySelector('input[type="file"][name="your-file"]');
    if (!fileInput || !fileInput.files || !fileInput.files.length) {
      setFormStatus(form, 'invalid', 'Please upload your CV (PDF or TXT).');
      return;
    }

    var formData = new FormData(form);
    if (!formData.get('fname') || !formData.get('lname') || !formData.get('email')) {
      setFormStatus(form, 'invalid', 'Please fill in all required fields.');
      return;
    }

    setSubmitting(form, true);

    fetch('/api/forms/careers', {
      method: 'POST',
      body: formData,
      headers: { Accept: 'application/json' }
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        setSubmitting(form, false);
        if (result.ok && result.data.success) {
          setFormStatus(form, 'sent', result.data.message);
          form.reset();
        } else {
          setFormStatus(
            form,
            'failed',
            (result.data && result.data.message) ||
              'Something went wrong. Please try again.'
          );
        }
      })
      .catch(function () {
        setSubmitting(form, false);
        setFormStatus(
          form,
          'failed',
          'Network error. Please check your connection and try again.'
        );
      });
  }

  function onFormSubmit(event) {
    var form = event.target;
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    var formType = getFormType(form);
    if (
      formType !== 'careers' &&
      form.id !== 'contactForm' &&
      !form.classList.contains('wpcf7-form') &&
      !form.closest('#submit_your_inquiry')
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (formType === 'careers') {
      submitCareersForm(form);
    } else {
      submitContactForm(form);
    }
  }

  /** Tab order: First Name, Last Name, Email, Phone, Message (layout is column-based). */
  function setInquiryTabOrder(form) {
    form.querySelectorAll('.wpcf7-form-control-wrap[tabindex]').forEach(function (wrap) {
      wrap.removeAttribute('tabindex');
    });

    var order = [
      ['fname', 1],
      ['lname', 2],
      ['email', 3],
      ['phone', 4],
      ['message', 5]
    ];
    order.forEach(function (pair) {
      var el = form.querySelector(
        'input[name="' + pair[0] + '"], textarea[name="' + pair[0] + '"]'
      );
      if (el) {
        el.setAttribute('tabindex', String(pair[1]));
      }
    });
    var submit = form.querySelector('[type="submit"]');
    if (submit) {
      submit.setAttribute('tabindex', '6');
    }
  }

  function init() {
    document.addEventListener('submit', onFormSubmit, true);

    var forms = document.querySelectorAll(
      '#contactForm, #submit_your_inquiry .wpcf7-form, section.careers .wpcf7-form'
    );
    forms.forEach(function (form) {
      if (form.getAttribute('action')) {
        form.setAttribute('data-original-action', form.getAttribute('action'));
      }
      form.setAttribute('action', 'javascript:void(0)');
      form.setAttribute('method', 'post');
      if (form.closest('#submit_your_inquiry')) {
        setInquiryTabOrder(form);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();


/* --- back-to-top.js --- */

jQuery(document).ready(function ($) {
  var duration = 400;
  var breakWdth = 769;

  $('.back-to-top').on('click', function (event) {
    event.preventDefault();
    $('html, body').animate({ scrollTop: 0 }, duration);
    return false;
  });

  $(window).on('scroll', function () {
    var ddWdth = $(window).outerWidth();
    var threshold = ddWdth > breakWdth ? 1000 : 500;
    if ($(this).scrollTop() > threshold) {
      $('.back-to-top').fadeIn(duration);
    } else {
      $('.back-to-top').fadeOut(duration);
    }
  });
});


/* --- timeline-swiper.js --- */

/**
 * About page timeline carousel (Swiper).
 */
jQuery(document).ready(function ($) {
  if (typeof Swiper === 'undefined' || !$('.a-timeline .mySwiper').length) {
    return;
  }

  new Swiper('.a-timeline .mySwiper', {
    spaceBetween: 5,
    slidesPerView: 1,
    navigation: {
      nextEl: '.a-timeline .custom-next',
      prevEl: '.a-timeline .custom-prev'
    },
    breakpoints: {
      640: {
        slidesPerView: 2,
        spaceBetween: 10
      },
      768: {
        slidesPerView: 3,
        spaceBetween: 16
      },
      1024: {
        slidesPerView: 4,
        spaceBetween: 20,
        slidesPerGroup: 1
      },
      1400: {
        slidesPerView: 5,
        spaceBetween: 16,
        slidesPerGroup: 1
      }
    }
  });
});

})();