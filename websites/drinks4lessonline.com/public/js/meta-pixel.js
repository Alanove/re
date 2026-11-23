(function (window) {
  'use strict';

  function isEnabled() {
    return typeof window.fbq === 'function';
  }

  function track(event, params) {
    if (!isEnabled()) return;
    if (params && typeof params === 'object') {
      window.fbq('track', event, params);
    } else {
      window.fbq('track', event);
    }
  }

  function trackAddToCart(meta) {
    if (!meta || !meta.contentId) return;
    var quantity = meta.quantity != null ? Number(meta.quantity) : 1;
    var unitValue = meta.value != null ? Number(meta.value) : 0;
    track('AddToCart', {
      content_ids: [meta.contentId],
      content_type: 'product',
      value: unitValue * quantity,
      currency: meta.currency || 'USD'
    });
  }

  window.MetaPixel = {
    isEnabled: isEnabled,
    track: track,
    trackAddToCart: trackAddToCart
  };
})(window);
