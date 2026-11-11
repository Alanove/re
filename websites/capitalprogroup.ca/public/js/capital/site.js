
$(document).ready(function () {
    "use strict";

    NavigationMenu();
    _activeMenu();

    $(window).on('scroll', function () {
        NavigationMenu();
    });

    var win = $(window);


    // scrollTop init
    var totop = $('#scrollUp');
    if (totop.length) {
        win.on('scroll', function () {
            if (win.scrollTop() > 150) {
                totop.fadeIn();
            } else {
                totop.fadeOut();
            }
        });
        totop.on('click', function () {
            $("html,body").animate({
                scrollTop: 0
            }, 500)
        });
    }

    /*----------------------------------------------------*/
    /*	OnScroll Animation
    /*----------------------------------------------------*/



    function NavigationMenu() {

        /*----------------------------------------------------*/
        /*	Navigtion Menu Scroll
        /*----------------------------------------------------*/

        var b = $(window).scrollTop();

        if (b > 120) {
            $("body").addClass("scroll");
        } else {
            $("body").removeClass("scroll");
        }
    }


    function _activeMenu() {

        var url = window.location.pathname,
            urlRegExp = new RegExp(url == '/' ? window.location.origin + '/?$' : url.replace(/\/$/, ''));

        $('.mainMenu a').each(function () {
            if (urlRegExp.test(this.href.replace(/\/$/, ''))) {
                $(this).parent().addClass('current');
            }
        });

        var x = url.split('/');
        if (x.length > 1) {
            $('.mainMenu a[href$="' + x[1] + '"]').parent().addClass('current');
        }

        $('.footer-menu a').each(function () {
            if (urlRegExp.test(this.href.replace(/\/$/, ''))) {
                $(this).parent().addClass('current');
            }
        });

        var x = url.split('/');
        if (x.length > 1) {
            $('.footer-menu a[href$="' + x[1] + '"]').parent().addClass('current');
        }

    }



    if ($(".galleryContainer #albums").length > 0) {
        ListImageGallery();
    }

    if ($(".map").length > 0) {
        initMap();
    }


    // reference for main items
    var carouselServices = $('.owl-carousel').not('.home-slider').not('.testimonial-carousel').not('.whychooseus3-carousel');

    if (carouselServices.length > 0) {

        // carousel function for main slider
        carouselServices.owlCarousel({
            //rtl: true,
            loop: true,
            dots: false,
            nav: true,
            center: true,
            lazyLoad: true,
            margin: 30,
            responsive: {
                0: {
                    stagePadding: 60,
                    items: 1
                },
                600: {
                    stagePadding: 60,
                    items: 2
                },
                1000: {
                    stagePadding: 100,
                    items: 3
                },
                1200: {
                    stagePadding: 100,
                    items: 3
                }
            }
        });

    }

	// reference for main items


    if ($.fn.validate && $("#ContactUs").length) {
    $("#ContactUs").validate({
        rules: {
            name: "required",
            email: {
                required: true,
                email: true
            },
            phone: "required",
            message: "required"
        },
        messages: {
            name: "Please enter your name",
            email: "Please enter a valid email address",
            phone: "Please enter your phone",
            message: "Please enter your message"
        },
        submitHandler: function (form) {
            $(form).ajaxSubmit({
                data: { ajax: true },
                cache: false,
                dataType: "json",
                success: function (e) {

                    var ajaxCallBack = e.callBack && typeof [e.callBack] === "function" ? e.callBack : $(form).attr("AjaxCallback");

                    if (isOk(ajaxCallBack) && typeof window[ajaxCallBack] === "function") {
                        window[ajaxCallBack](e);
                    }
                }
            });
            return false;
        }
    });
    }

});

function defined(a) {
    var ret = typeof a === "undefined";
    if (ret === true)
        return false;
    if (typeof a === "string" && a === "")
        return false;
    return a !== null;
}

function isOk(a) {
    return defined(a);
}

function ListImageGallery() {
 
    var gridContainer = $('.galleryContainer #albums');


    /*********************************
     init cubeportfolio
     *********************************/
    gridContainer.cubeportfolio({
        layoutMode: 'grid',
        rewindNav: true,
        scrollByPage: true,
        mediaQueries: [{
            width: 680,
            cols: 4
        }, {
            width: 480,
            cols: 3
        }, {
            width: 340,
            cols: 2
        }],
        defaultFilter: '*',
        animationType: 'rotateSides',
        gapHorizontal: 15,
        gapVertical: 15,
        gridAdjustment: 'responsive',
        caption: 'fadeIn',
        displayType: 'sequentially',
        displayTypeSpeed: 300,

        // lightbox
        lightboxDelegate: '.cbp-lightbox',
        lightboxGallery: true,
        lightboxTitleSrc: 'data-title',
        lightboxCounter: '<div class="cbp-popup-lightbox-counter">{{current}} of {{total}}</div>'
    });
}


/* google map
================================================== */
// Initialize and add the map
function initMap() {
    var London = { lat: 45.39355708828502, lng: -75.75104224521027 };
    var map = new google.maps.Map(
        document.getElementById('map'), { zoom: 15, center: Canada });
    var markerDot = new google.maps.Marker({ position: Canada, map: map });
}

$(window).on('load', function () {
    $('#preloader').fadeOut('slow', function () { $(this).remove(); });

    if (typeof AOS !== 'undefined') {
        AOS.init({
            once: true,
            offset: 120,
            delay: 40,
            duration: 500
        });
    }
});