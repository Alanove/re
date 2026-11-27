(function () {
  var DISMISS_KEY = 'smb-pwa-suggest-dismissed';
  var deferredPrompt = null;

  function isStandalone() {
    return (
      window.matchMedia('(display-mode: standalone)').matches ||
      window.navigator.standalone === true
    );
  }

  function isIos() {
    return /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');
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
      var which = btn.getAttribute('data-pwa-install');
      if (isStandalone()) {
        btn.hidden = true;
        return;
      }
      if (which === 'account' && deferredPrompt) {
        btn.hidden = false;
      } else if (which === 'gate' && deferredPrompt) {
        btn.hidden = false;
      }
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

  function showIosHints() {
    if (!isIos() || isStandalone()) return;
    document.querySelectorAll('[data-pwa-ios]').forEach(function (el) {
      el.hidden = false;
    });
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
    showIosHints();
    setupSuggestBanner();
    updateInstallButtons();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
