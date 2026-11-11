jQuery(document).ready(function ($) {
  if ($('.homeslider').length && typeof $.fn.slick === 'function') {
    $('.homeslider').slick({
      dots: true,
      infinite: true,
      speed: 500,
      fade: true,
      cssEase: 'linear',
      autoplay: true,
      autoplaySpeed: 5000,
      arrows: true
    });
  }
});
