/**
 * Google reCAPTCHA v2 Invisible helpers.
 * Expects window.__RECAPTCHA_SITE_KEY__ when captcha is configured.
 */
(function (window, document) {
  'use strict';

  var widgetId = null;
  var pendingResolve = null;
  var pendingReject = null;
  var holderEl = null;

  function getSiteKey() {
    return window.__RECAPTCHA_SITE_KEY__ || '';
  }

  function ensureWidget() {
    return new Promise(function (resolve, reject) {
      var siteKey = getSiteKey();
      if (!siteKey) {
        resolve(null);
        return;
      }

      function render() {
        if (widgetId !== null) {
          resolve(widgetId);
          return;
        }
        if (typeof grecaptcha === 'undefined' || !grecaptcha.render) {
          reject(new Error('reCAPTCHA failed to load'));
          return;
        }
        holderEl = document.createElement('div');
        holderEl.style.display = 'none';
        document.body.appendChild(holderEl);
        widgetId = grecaptcha.render(holderEl, {
          sitekey: siteKey,
          size: 'invisible',
          callback: function (token) {
            if (pendingResolve) {
              pendingResolve(token);
              pendingResolve = null;
              pendingReject = null;
            }
          },
          'error-callback': function () {
            if (pendingReject) {
              pendingReject(new Error('reCAPTCHA error'));
              pendingResolve = null;
              pendingReject = null;
            }
          },
          'expired-callback': function () {
            if (pendingReject) {
              pendingReject(new Error('reCAPTCHA expired'));
              pendingResolve = null;
              pendingReject = null;
            }
          }
        });
        resolve(widgetId);
      }

      if (typeof grecaptcha !== 'undefined' && grecaptcha.render) {
        render();
      } else {
        window.__onRecaptchaApiLoad = function () {
          try {
            render();
          } catch (err) {
            reject(err);
          }
        };
        // If script already loaded with onload already fired
        setTimeout(function () {
          if (typeof grecaptcha !== 'undefined' && grecaptcha.render && widgetId === null) {
            try {
              render();
            } catch (err) {
              reject(err);
            }
          }
        }, 1500);
      }
    });
  }

  /**
   * Execute invisible reCAPTCHA and return a token Promise.
   * Resolves with '' when site key is not configured (dev bypass).
   */
  window.executeInvisibleRecaptcha = function () {
    if (!getSiteKey()) {
      return Promise.resolve('');
    }

    return ensureWidget().then(function (id) {
      return new Promise(function (resolve, reject) {
        pendingResolve = resolve;
        pendingReject = reject;
        try {
          grecaptcha.reset(id);
          grecaptcha.execute(id);
        } catch (err) {
          pendingResolve = null;
          pendingReject = null;
          reject(err);
        }
      });
    });
  };

  /**
   * Bind invisible reCAPTCHA to a classic form submit.
   * @param {HTMLFormElement|string} formOrSelector
   * @param {{ beforeSubmit?: function(): boolean|Promise<boolean>, onError?: function(Error): void }} [options]
   */
  window.bindInvisibleRecaptcha = function (formOrSelector, options) {
    var form =
      typeof formOrSelector === 'string'
        ? document.querySelector(formOrSelector)
        : formOrSelector;
    if (!form) return;

    var opts = options || {};
    var submitting = false;

    form.addEventListener('submit', function (event) {
      if (submitting) {
        event.preventDefault();
        return;
      }

      var existing = form.querySelector('input[name="g-recaptcha-response"], textarea[name="g-recaptcha-response"]');
      if (existing && existing.value) {
        return;
      }

      if (!getSiteKey()) {
        return;
      }

      event.preventDefault();

      Promise.resolve(typeof opts.beforeSubmit === 'function' ? opts.beforeSubmit() : true)
        .then(function (ok) {
          if (ok === false) return null;
          submitting = true;
          return window.executeInvisibleRecaptcha();
        })
        .then(function (token) {
          if (token === null || token === undefined) {
            submitting = false;
            return;
          }
          var field = form.querySelector('input[name="g-recaptcha-response"]');
          if (!field) {
            field = document.createElement('input');
            field.type = 'hidden';
            field.name = 'g-recaptcha-response';
            form.appendChild(field);
          }
          field.value = token || '';
          submitting = false;
          form.submit();
        })
        .catch(function (err) {
          submitting = false;
          if (typeof opts.onError === 'function') {
            opts.onError(err);
          } else {
            console.error('reCAPTCHA failed', err);
          }
        });
    });
  };
})(window, document);
