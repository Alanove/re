jQuery(document).ready(function ($) {
  var duration = 400;
  var breakWdth = 769;

  $('.back-to-top').on('click', function (event) {
    event.preventDefault();
    $('html, body').animate({ scrollTop: 0 }, duration);
    return false;
  });

  $(window).on('scroll', function () {
    var ddWdth = $(window).outerWidth();
    var threshold = ddWdth > breakWdth ? 1000 : 500;
    if ($(this).scrollTop() > threshold) {
      $('.back-to-top').fadeIn(duration);
    } else {
      $('.back-to-top').fadeOut(duration);
    }
  });
});
