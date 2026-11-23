(function () {
  function bindCaptchaForms() {
    if (!window.SiteCaptcha) {
      return;
    }
    document.querySelectorAll('form[action="/contact"], form[action="/feedback"]').forEach(function (form) {
      form.addEventListener('submit', function (event) {
        var scope = form.getAttribute('action') === '/feedback' ? 'feedback' : 'contact';
        var tokenInput = form.querySelector('[data-captcha-token]');
        if (!tokenInput || tokenInput.value) {
          return;
        }
        event.preventDefault();
        window.SiteCaptcha.getToken(scope)
          .then(function (token) {
            tokenInput.value = token;
            form.submit();
          })
          .catch(function () {
            form.submit();
          });
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindCaptchaForms);
  } else {
    bindCaptchaForms();
  }
})();
