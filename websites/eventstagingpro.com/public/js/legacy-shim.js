/* The legacy skin calls lw.AppendInit and two jQuery helpers that lived in the old CMS runtime. */
window.lw = window.lw || {
  AppendInit(fn) {
    fn();
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
