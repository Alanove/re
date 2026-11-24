/* The legacy skin calls lw.AppendInit/AppendLoad and jQuery helpers that lived in the old CMS runtime. */
window.lw = window.lw || {
  AppendInit(fn) {
    if (typeof fn === 'function') {
      fn();
    }
  },
  AppendLoad(fn) {
    if (typeof fn !== 'function') {
      return;
    }
    if (document.readyState === 'complete') {
      fn();
      return;
    }
    window.addEventListener('load', fn);
  }
};

(function ($) {
  if (!$ || typeof $ !== 'function') {
    return;
  }
  if (typeof $.browserSelector !== 'function') {
    $.browserSelector = function () {};
  }
  if (typeof $.smoothScroll !== 'function') {
    $.smoothScroll = function () {};
  }
  // jQuery 3 removed $(window).load; the home preloader in site.js still uses it.
  if (!jQuery.fn.load || jQuery.fn.load.length < 2) {
    const originalOn = jQuery.fn.on;
    jQuery.fn.load = function (handler) {
      if (typeof handler === 'function') {
        return this.on('load', handler);
      }
      return originalOn ? jQuery.fn.on.apply(this, arguments) : this;
    };
  }
})(window.jQuery);
