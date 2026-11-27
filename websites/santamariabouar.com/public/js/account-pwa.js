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
      if (isStandalone()) {
        btn.hidden = true;
        return;
      }
      // Chrome often skips beforeinstallprompt after another app from this site is installed.
      // Keep a visible Install button only when the deferred prompt is available.
      btn.hidden = !deferredPrompt;
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
    document.querySelectorAll('[data-pwa-manual], [data-pwa-ios]').forEach(function (el) {
      // Always show manual steps: BIP is unreliable once another PWA is installed.
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
