/**
 * About page timeline carousel (Swiper).
 */
jQuery(document).ready(function ($) {
  if (typeof Swiper === 'undefined' || !$('.a-timeline .mySwiper').length) {
    return;
  }

  new Swiper('.a-timeline .mySwiper', {
    spaceBetween: 5,
    slidesPerView: 1,
    navigation: {
      nextEl: '.a-timeline .custom-next',
      prevEl: '.a-timeline .custom-prev'
    },
    breakpoints: {
      640: {
        slidesPerView: 2,
        spaceBetween: 10
      },
      768: {
        slidesPerView: 3,
        spaceBetween: 16
      },
      1024: {
        slidesPerView: 4,
        spaceBetween: 20,
        slidesPerGroup: 1
      },
      1400: {
        slidesPerView: 5,
        spaceBetween: 16,
        slidesPerGroup: 1
      }
    }
  });
});
