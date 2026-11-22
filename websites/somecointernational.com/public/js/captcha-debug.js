(function () {
  try {
    var params = new URLSearchParams(window.location.search);
    var flag = params.get('captchaDebug');
    if (flag === '1') {
      localStorage.setItem('captchaDebug', '1');
    } else if (flag === '0') {
      localStorage.removeItem('captchaDebug');
    }
    if (localStorage.getItem('captchaDebug') === '1') {
      document.documentElement.classList.add('captcha-debug');
    }
  } catch (e) {}
})();
