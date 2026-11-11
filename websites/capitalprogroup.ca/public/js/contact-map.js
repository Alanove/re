jQuery(document).ready(function ($) {
  function showPin(pinSelector, contentSelector, textSelector) {
    $(pinSelector).parent().addClass('clicked').siblings().removeClass('clicked');
    $(pinSelector).parent().siblings().find('.pin-text').hide();
    $(contentSelector).siblings('.pin-content').hide().css('opacity', '0');
    $(contentSelector).show().fadeIn(300).css('opacity', '1');
    if (textSelector) $(textSelector).show().fadeIn(300);
  }

  $('.pin-1 .round-pin').on('click', function () {
    showPin('.pin-1 .round-pin', '.pin-content.pin-1-content', '.pin1-text');
  });
  $('.pin-2 .round-pin').on('click', function () {
    showPin('.pin-2 .round-pin', '.pin-content.pin-2-content', '.pin2-text');
  });
  $('.pin-3 .round-pin').on('click', function () {
    showPin('.pin-3 .round-pin', '.pin-content.pin-3-content', '.pin3-text');
  });
  $('.pin-4 .round-pin').on('click', function () {
    showPin('.pin-4 .round-pin', '.pin-content.pin-4-content', '.pin4-text');
  });
});
