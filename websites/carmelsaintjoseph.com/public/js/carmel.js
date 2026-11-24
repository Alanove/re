(function ($) {
  'use strict';

  function initGalleries() {
    var $grid = $('#grid-container, #albums');
    if (!$grid.length || typeof $grid.cubeportfolio !== 'function') {
      return;
    }
    $grid.cubeportfolio({
      layoutMode: 'grid',
      defaultFilter: '*',
      animationType: 'quicksand',
      gapHorizontal: 20,
      gapVertical: 20,
      gridAdjustment: 'responsive',
      mediaQueries: [
        { width: 1100, cols: 3 },
        { width: 800, cols: 3 },
        { width: 480, cols: 2 },
        { width: 320, cols: 1 }
      ],
      lightboxDelegate: '.cbp-lightbox',
      lightboxGallery: true
    });
  }

  function initNavDrawer() {
    var $drawer = $('#navbarText');
    var $backdrop = $('#navDrawerBackdrop');
    var $toggle = $('#navDrawerToggle');
    var $close = $('#navDrawerClose');
    if (!$drawer.length || !$toggle.length) {
      return;
    }

    function openDrawer() {
      $drawer.addClass('is-open').attr('aria-hidden', 'false');
      $toggle.addClass('is-open').attr('aria-expanded', 'true').removeClass('collapsed');
      $backdrop.prop('hidden', false).addClass('is-open');
      $('body').addClass('nav-drawer-open');
    }

    function closeDrawer() {
      $drawer.removeClass('is-open').attr('aria-hidden', 'true');
      $toggle.removeClass('is-open').attr('aria-expanded', 'false').addClass('collapsed');
      $backdrop.removeClass('is-open').prop('hidden', true);
      $('body').removeClass('nav-drawer-open');
      $drawer.find('.nav-item.is-expanded').removeClass('is-expanded');
      $drawer.find('.nav-submenu-toggle').attr('aria-expanded', 'false');
    }

    $toggle.on('click', function (event) {
      event.preventDefault();
      if ($drawer.hasClass('is-open')) {
        closeDrawer();
      } else {
        openDrawer();
      }
    });

    $close.on('click', function (event) {
      event.preventDefault();
      closeDrawer();
    });

    $backdrop.on('click', function () {
      closeDrawer();
    });

    $drawer.on('click', '.nav-submenu-toggle', function (event) {
      event.preventDefault();
      event.stopPropagation();
      var $item = $(this).closest('.nav-item');
      var open = !$item.hasClass('is-expanded');
      $drawer.find('.nav-item.is-expanded').not($item).removeClass('is-expanded')
        .find('.nav-submenu-toggle').attr('aria-expanded', 'false');
      $item.toggleClass('is-expanded', open);
      $(this).attr('aria-expanded', open ? 'true' : 'false');
    });

    $(window).on('resize', function () {
      if (window.matchMedia('(min-width: 992px)').matches) {
        closeDrawer();
      }
    });

    $(document).on('keyup', function (event) {
      if (event.key === 'Escape') {
        closeDrawer();
      }
    });
  }

  $(function () {
    initGalleries();
    initNavDrawer();
    $('#back-to-top').on('click', function (event) {
      event.preventDefault();
      $('html, body').animate({ scrollTop: 0 }, 400);
    });
  });
})(jQuery);
