(function () {
  var DISMISS_KEY = 'smb-pwa-suggest-dismissed';
  var deferredPrompt = null;

  function isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }

  function ua() {
    return window.navigator.userAgent || '';
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(ua()) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  }

  function isSamsungInternet() {
    return /SamsungBrowser/i.test(ua());
  }

  function isAndroid() {
    return /android/i.test(ua());
  }

  function isChromeAndroid() {
    return isAndroid() && /Chrome|CriOS/i.test(ua()) && !isSamsungInternet() && !/EdgA|OPR|Firefox/i.test(ua());
  }

  function detectHelpKind() {
    if (isIos()) return 'ios';
    if (isSamsungInternet()) return 'samsung';
    if (isChromeAndroid()) return 'chrome-android';
    if (isAndroid()) return 'android';
    return 'other';
  }

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/pwa/sw.js', { scope: '/' }).catch(function (err) {
      console.warn('PWA service worker registration failed', err);
    });
  }

  function updateInstallButtons() {
    var buttons = document.querySelectorAll('[data-pwa-install]');
    buttons.forEach(function (btn) {
      if (isStandalone()) {
        btn.hidden = true;
        return;
      }
      btn.hidden = !deferredPrompt;
    });
    updateHelpPanels();
  }

  function updateHelpPanels() {
    if (isStandalone()) {
      document.querySelectorAll('[data-pwa-help]').forEach(function (el) {
        el.hidden = true;
      });
      return;
    }

    var kind = deferredPrompt ? 'prompt' : detectHelpKind();
    document.querySelectorAll('[data-pwa-help]').forEach(function (el) {
      el.hidden = el.getAttribute('data-pwa-help') !== kind;
    });
  }

  function wireInstallButtons() {
    document.querySelectorAll('[data-pwa-install]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.finally(function () {
          deferredPrompt = null;
          updateInstallButtons();
        });
      });
    });
  }

  function showManualHints() {
    if (isStandalone()) return;
    document.querySelectorAll('[data-pwa-manual]').forEach(function (el) {
      el.hidden = false;
    });
    updateHelpPanels();
  }

  function setupSuggestBanner() {
    var banner = document.getElementById('accountPwaSuggest');
    if (!banner || isStandalone()) return;
    try {
      if (window.localStorage.getItem(DISMISS_KEY) === '1') return;
    } catch (err) {
      /* ignore */
    }
    banner.hidden = false;
    var dismiss = document.getElementById('accountPwaSuggestDismiss');
    if (dismiss) {
      dismiss.addEventListener('click', function () {
        banner.hidden = true;
        try {
          window.localStorage.setItem(DISMISS_KEY, '1');
        } catch (err) {
          /* ignore */
        }
      });
    }
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    deferredPrompt = event;
    updateInstallButtons();
  });

  window.addEventListener('appinstalled', function () {
    deferredPrompt = null;
    updateInstallButtons();
  });

  function init() {
    registerServiceWorker();
    wireInstallButtons();
    showManualHints();
    setupSuggestBanner();
    updateInstallButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
