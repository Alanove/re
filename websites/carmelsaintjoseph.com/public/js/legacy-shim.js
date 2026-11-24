/* The legacy skin calls lw.AppendInit/AppendLoad and two jQuery helpers that lived in the old CMS runtime. */
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
})(window.jQuery);
