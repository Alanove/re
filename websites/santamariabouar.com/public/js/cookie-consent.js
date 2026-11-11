(function () {
  var CONSENT_KEY = 'smb_cookie_consent';
  var CONSENT_MAX_AGE_DAYS = 365;

  function getCookie(name) {
    var match = document.cookie.match(new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)'));
    return match ? decodeURIComponent(match[1]) : null;
  }

  function setCookie(name, value, days) {
    var expires = '';
    if (typeof days === 'number') {
      var date = new Date();
      date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
      expires = '; expires=' + date.toUTCString();
    }
    document.cookie = name + '=' + encodeURIComponent(value) + expires + '; path=/; SameSite=Lax';
  }

  function hasAccepted() {
    return getCookie(CONSENT_KEY) === 'accepted';
  }

  function acceptAll() {
    setCookie(CONSENT_KEY, 'accepted', CONSENT_MAX_AGE_DAYS);
    hideBanner();
    // Hook for Google Analytics (and similar) once configured.
    if (typeof window.onCookieConsentAccepted === 'function') {
      try {
        window.onCookieConsentAccepted();
      } catch (err) {
        // Ignore listener errors so consent UX still completes.
      }
    }
  }

  function hideBanner() {
    var banner = document.getElementById('cookieBanner');
    if (!banner) return;

    banner.classList.add('is-hiding');
    window.setTimeout(function () {
      banner.hidden = true;
      banner.classList.remove('is-hiding');
    }, 280);
  }

  function showBanner() {
    var banner = document.getElementById('cookieBanner');
    if (!banner) return;
    banner.hidden = false;
  }

  function init() {
    var acceptBtn = document.getElementById('cookieBannerAccept');
    if (acceptBtn) {
      acceptBtn.addEventListener('click', acceptAll);
    }

    if (!hasAccepted()) {
      showBanner();
    }
  }

  window.SantaMariaCookieConsent = {
    hasAccepted: hasAccepted,
    /** True when the visitor accepted cookies (analytics may load). */
    hasAnalyticsConsent: hasAccepted,
    acceptAll: acceptAll
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
