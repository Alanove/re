(function ($) {

  'use strict';

  // loader
  var loader = function () {
    setTimeout(function () {
      if ($('#loader').length > 0) {
        $('#loader').removeClass('show');
      }
    }, 1);
  };
  loader();

  var isDesktopNav = function () {
    return window.matchMedia('(min-width: 992px)').matches;
  };

  var closeNestedSubmenus = function ($scope) {
    $scope.find('.dropdown-submenu').removeClass('show');
    $scope.find('.submenu').removeClass('show').css('display', '');
  };

  // Desktop: open top-level dropdowns on hover (parent links still navigate on click)
  $('nav .navbar-nav > .dropdown').on('mouseenter', function () {
    if (!isDesktopNav()) {
      return;
    }
    var $this = $(this);
    $this.addClass('show');
    $this.children('.dropdown-toggle').attr('aria-expanded', 'true');
    $this.children('.dropdown-menu').addClass('show');
  }).on('mouseleave', function () {
    if (!isDesktopNav()) {
      return;
    }
    var $this = $(this);
    $this.removeClass('show');
    $this.children('.dropdown-toggle').attr('aria-expanded', 'false');
    $this.children('.dropdown-menu').removeClass('show');
    closeNestedSubmenus($this);
  });

  // Desktop: open second-level flyouts on hover (bind directly — delegated mouseenter is unreliable)
  $('nav .dropdown-submenu').on('mouseenter', function () {
    if (!isDesktopNav()) {
      return;
    }
    var $item = $(this);
    $item.siblings('.dropdown-submenu').removeClass('show').children('.submenu').removeClass('show').css('display', '');
    $item.addClass('show');
    $item.children('.submenu').addClass('show').css('display', 'block');
  }).on('mouseleave', function () {
    if (!isDesktopNav()) {
      return;
    }
    var $item = $(this);
    $item.removeClass('show');
    $item.children('.submenu').removeClass('show').css('display', '');
  });

  // Prevent Bootstrap from closing when clicking inside an open menu
  $(document).on('click', '.dropdown-menu', function (e) {
    e.stopPropagation();
  });

  // Desktop: nested toggles navigate; do not require a click to open the flyout
  $(document).on('click', 'nav .dropdown-menu a.dropdown-toggle', function (e) {
    if (isDesktopNav()) {
      return;
    }
    var $submenu = $(this).next('.submenu');
    if ($submenu.length) {
      e.preventDefault();
      $submenu.toggle();
    }
  });

  $('.dropdown').on('hide.bs.dropdown', function () {
    closeNestedSubmenus($(this));
  });

  // home slider (Owl only when marked as carousel — inner page heroes use .home-slider.inner-page alone)
  $('.owl-carousel.home-slider').owlCarousel({
    loop: true,
    autoplay: true,
    margin: 10,
    animateOut: 'fadeOut',
    animateIn: 'fadeIn',
    nav: true,
    autoplayHoverPause: true,
    items: 1,
    navText: ["<span class='ion-chevron-left'></span>", "<span class='ion-chevron-right'></span>"],
    responsive: {
      0: {
        items: 1,
        nav: false
      },
      600: {
        items: 1,
        nav: false
      },
      1000: {
        items: 1,
        nav: true
      }
    }
  });

  // owl carousel
  var majorCarousel = $('.js-carousel-1');
  majorCarousel.owlCarousel({
    loop: true,
    autoplay: true,
    stagePadding: 7,
    margin: 20,
    animateOut: 'fadeOut',
    animateIn: 'fadeIn',
    nav: true,
    autoplayHoverPause: true,
    items: 3,
    navText: ["<span class='ion-chevron-left'></span>", "<span class='ion-chevron-right'></span>"],
    responsive: {
      0: {
        items: 1,
        nav: false
      },
      600: {
        items: 2,
        nav: false
      },
      1000: {
        items: 3,
        nav: true,
        loop: false
      }
    }
  });

  // owl carousel
  var major2Carousel = $('.js-carousel-2');
  major2Carousel.owlCarousel({
    loop: true,
    autoplay: true,
    stagePadding: 7,
    margin: 20,
    animateOut: 'fadeOut',
    animateIn: 'fadeIn',
    nav: true,
    autoplayHoverPause: true,
    items: 4,
    navText: ["<span class='ion-chevron-left'></span>", "<span class='ion-chevron-right'></span>"],
    responsive: {
      0: {
        items: 1,
        nav: false
      },
      600: {
        items: 3,
        nav: false
      },
      1000: {
        items: 4,
        nav: true,
        loop: false
      }
    }
  });

  var clientsCarousel = $('.clients-carousel');
  clientsCarousel.owlCarousel({
    loop: true,
    nav: false,
    dots: false,
    autoplay: true,
    // autoplayTimeout: 3e3,
    responsiveClass: true,
    autoplayHoverPause: false,
    smartSpeed: 900,
    responsive: {
      0: {
        items: 2,
        margin: 20
      },
      768: {
        items: 3,
        margin: 40
      },
      992: {
        items: 4,
        margin: 60
      },
      1200: {
        items: 5,
        margin: 80
      }
    }
  })


  var contentWayPoint = function () {
    var i = 0;
    $('.element-animate').waypoint(function (direction) {

      if (direction === 'down' && !$(this.element).hasClass('element-animated')) {

        i++;

        $(this.element).addClass('item-animate');
        setTimeout(function () {

          $('body .element-animate.item-animate').each(function (k) {
            var el = $(this);
            setTimeout(function () {
              var effect = el.data('animate-effect');
              if (effect === 'fadeIn') {
                el.addClass('fadeIn element-animated');
              } else if (effect === 'fadeInLeft') {
                el.addClass('fadeInLeft element-animated');
              } else if (effect === 'fadeInRight') {
                el.addClass('fadeInRight element-animated');
              } else {
                el.addClass('fadeInUp element-animated');
              }
              el.removeClass('item-animate');
            }, k * 100);
          });

        }, 100);

      }

    }, {
      offset: '95%'
    });
  };
  contentWayPoint();

    //add class to feeback


})(jQuery);