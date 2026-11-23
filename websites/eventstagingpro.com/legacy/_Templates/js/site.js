lw.AppendInit(function () {

    // Adds browser version on html class.
    $.browserSelector();

    // Adds window smooth scroll on chrome.
    if ($("html").hasClass("chrome")) {
        $.smoothScroll();
    }

    //	handleToggle();

    $(window).resize(function () {
        //handleToggle();
    });

    /*----------------------------------------------------*/
    /*  Scroll To Top Section
    /*----------------------------------------------------*/


    jQuery(window).scroll(function () {

        if (jQuery(this).scrollTop() > 100) {
            jQuery('.scrollup').fadeIn();
        } else {
            jQuery('.scrollup').fadeOut();
        }

    });

    jQuery('.scrollup').click(function () {
        jQuery("html, body").animate({
            scrollTop: 0
        }, 600);
        return false;
    });

    if ($(".newsContainer").length > 0)
        NewsGallery();


    if ($(".galleryContainer").length > 0)
        ImageGallery();

    if ($(".promo-section").length > 0)
        $(".promo-section").slick({
            autoplay: false,
            arrows: true,
            dots: false,
            slidesToShow: 1,
            prevArrow: '<div class="slick-prev"><i class="fa fa-chevron-left"></i></div>',
            nextArrow: '<div class="slick-next"><i class="fa fa-chevron-right"></i></div>'
        });

    if ($(".posts-section").length > 0)
        $('.posts-section .posts-list article:first').addClass('post-first');

    $(".mainMenu ul ul").each(function () {
        var _ = $(this);
        var a = _.parent().children('a');
        a.addClass("dropdown-toggle");
        a.attr("data-toggle", "dropdown");
        _.addClass("dropdown-menu");
        _.removeClass("dropdown");
        _.parent().addClass("dropdown");
    });


    if ($("#photos").length > 0)
        HomePhotos();

    //if ($("#videos").length > 0)
    //    HomeVideos();

    $('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
        e.target;
        e.relatedTarget;

        if ($(this).attr('aria-controls') == 'photos')
            HomePhotos();
        else
            HomeVideos();
    })

    //$('.cbp-lightbox-wrapper').cubeportfolio({
    //	// lightboxGallery: false,
    //	// lightboxCounter: '',
    //});

});

function handleToggle() {
    //if ($(window).width() < 767) {
    //    $('.navbar-collapse a').click(function (e) {
    //        $('.navbar-collapse').collapse('toggle');
    //    });
    //}
}

function HomePhotos() {
    var mySwiper = new Swiper('.photoscontainer', {
        pagination: '.photos-pagination',
        slidesPerView: 1,
        slidesPerColumn: 1,
        spaceBetween: 30,
        preventClicks: false,
        paginationClickable: true,
        breakpoints: {
            // when window width is <= 991px
            2000: {
                slidesPerView: 4,
            },
            // when window width is <= 991px
            991: {
                slidesPerView: 4,
            },
            // when window width is <= 767px
            767: {
                slidesPerView: 3,
            },
            // when window width is <= 599px
            599: {
                slidesPerView: 2,
            },
            // when window width is <= 499px
            499: {
                slidesPerView: 2,
            },
            // when window width is <= 399px
            399: {
                slidesPerView: 1,
            },
        }
    });
}

function HomeVideos() {
    var mySwiper = new Swiper('.videoscontainer', {
        pagination: '.videos-pagination',
        slidesPerView: 1,
        slidesPerColumn: 1,
        spaceBetween: 30,
        preventClicks: false,
        paginationClickable: true,
        breakpoints: {
            // when window width is <= 991px
            2000: {
                slidesPerView: 4,
            },
            // when window width is <= 991px
            991: {
                slidesPerView: 4,
            },
            // when window width is <= 767px
            767: {
                slidesPerView: 3,
            },
            // when window width is <= 599px
            599: {
                slidesPerView: 2,
            },
            // when window width is <= 499px
            499: {
                slidesPerView: 2,
            },
            // when window width is <= 399px
            399: {
                slidesPerView: 1,
            },
        }
    });
}


function ImageGallery() {

    var gridContainer = $('#grid-container');


    /*********************************
     init cubeportfolio
     *********************************/
    gridContainer.cubeportfolio({
        layoutMode: 'grid',
        rewindNav: true,
        scrollByPage: true,
        mediaQueries: [{
            width: 1100,
            cols: 4
        }, {
            width: 800,
            cols: 3
        }, {
            width: 500,
            cols: 2
        }, {
            width: 320,
            cols: 1
        }],
        defaultFilter: '*',
        animationType: 'rotateSides',
        gapHorizontal: 30,
        gapVertical: 30,
        gridAdjustment: 'responsive',
        caption: 'fadeIn',
        displayType: 'sequentially',
        displayTypeSpeed: 100,

        // lightbox
        lightboxDelegate: '.cbp-lightbox',
        lightboxGallery: true,
        lightboxTitleSrc: 'data-title',
        lightboxCounter: '<div class="cbp-popup-lightbox-counter">{{current}} of {{total}}</div>'
    });
}

function NewsGallery() {

    var gridContainer = $('#grid-container');


    /*********************************
     init cubeportfolio
     *********************************/
    gridContainer.cubeportfolio({
        layoutMode: 'grid',
        rewindNav: true,
        scrollByPage: false,
        mediaQueries: [{
            width: 1100,
            cols: 2
        }, {
            width: 800,
            cols: 2
        }, {
            width: 500,
            cols: 1
        }, {
            width: 320,
            cols: 1
        }],
        defaultFilter: '*',
        animationType: 'rotateSides',
        gapHorizontal: 30,
        gapVertical: 30,
        gridAdjustment: 'responsive',
        caption: 'fadeIn',
        displayType: 'sequentially',
        displayTypeSpeed: 100,

        // lightbox
        lightboxDelegate: '.cbp-lightbox',
        lightboxGallery: true,
        lightboxTitleSrc: 'data-title',
        lightboxCounter: '<div class="cbp-popup-lightbox-counter">{{current}} of {{total}}</div>'
    });
}