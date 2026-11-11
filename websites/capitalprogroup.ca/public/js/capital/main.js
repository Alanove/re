/*-----------------------------------------------------------------------------------

    Theme Name: Secure - Insurance Agency HTML Template
    Description: Insurance Agency HTML Template
    Author: Chitrakoot Web
    Version: 1.0
        
    ---------------------------------- */

!(function ($) {
    "use strict";
    var $window = $(window);
    function a() {
        var e, a;
        (e = $(".full-screen")), (a = $window.height()), e.css("min-height", a), (e = $("header").height()), (a = $(".screen-height")), (e = $window.height() - e), a.css("height", e);
    }
    $("#preloader").fadeOut("normall", function () {
        $(this).remove();
    }),
        $.scrollIt({ upKey: 38, downKey: 40, easing: "swing", scrollTime: 600, activeClass: "active", onPageChange: null, topOffset: -70 }),
        $window.on("scroll", function () {
            var e = $window.scrollTop(),
                a = $(".navbar-brand img"),
                o = $(".navbar-brand.logodefault img");
            e <= 50 ? ($("header").removeClass("scrollHeader").addClass("fixedHeader")) : ($("header").removeClass("fixedHeader").addClass("scrollHeader"));

/*           
 *           e <= 50 ? ($("header").removeClass("scrollHeader").addClass("fixedHeader"), a.attr("src", "images/capital-group-logo.png")) : ($("header").removeClass("fixedHeader").addClass("scrollHeader"), a.attr("src", "img/logos/capital-group-logo.png")),
                o.attr("src", "images/capital-group-logo.png");
                */
        }),
        $window.on("scroll", function () {
            500 < $(this).scrollTop() ? $(".scroll-to-top").fadeIn(400) : $(".scroll-to-top").fadeOut(400);
        }),
        $(".scroll-to-top").on("click", function (e) {
            e.preventDefault(), $("html, body").animate({ scrollTop: 0 }, 600);
        }),
        $window.on("scroll", function () {
            var e = $window.scrollTop(),
                a = $(".onepage-nav.navbar");
            100 < e ? a.addClass("nav-scroll") : a.removeClass("nav-scroll");
        }),
        $window.width() <= 991 &&
        $(".onepage-nav .navbar-nav .nav-link").on("click", function () {
            $(".onepage-nav .navbar-nav").removeClass("open").hide(), $(".onepage-nav .navbar-toggler").removeClass("menu-opened");
        }),
        $("#sidebar_toggle").length &&
        ($("body").addClass("sidebar-menu"),
            $("#sidebar_toggle").on("click", function () {
                $(".sidebar-menu").toggleClass("active"), $(".side-menu").addClass("side-menu-active"), $("#close_sidebar").fadeIn(700);
            }),
            $("#close_sidebar").on("click", function () {
                $(".side-menu").removeClass("side-menu-active"), $(this).fadeOut(200), $(".sidebar-menu").removeClass("active");
            }),
            $("#btn_sidebar_colse").on("click", function () {
                $(".side-menu").removeClass("side-menu-active"), $("#close_sidebar").fadeOut(200), $(".sidebar-menu").removeClass("active");
            })),
        new WOW({ boxClass: "wow", animateClass: "animated", offset: 0, mobile: false, live: true }).init(),
        $(".parallax,.bg-img").each(function (e) {
            $(this).attr("data-background") && $(this).css("background-image", "url(" + $(this).data("background") + ")");
        }),
        $(".story-video").magnificPopup({ delegate: ".video", type: "iframe" }),
        $(".source-modal").magnificPopup({ type: "inline", mainClass: "mfp-fade", removalDelay: 160 }),
        $(".current-year").text(new Date().getFullYear()),
        $window.resize(function (e) {
            setTimeout(function () {
                a();
            }, 500),
                e.preventDefault();
        }),
        a(),
        0 !== $(".copy-clipboard").length &&
        (new ClipboardJS(".copy-clipboard"),
            $(".copy-clipboard").on("click", function () {
                var e = $(this);
                e.text();
                e.text("Copied"),
                    setTimeout(function () {
                        e.text("Copy");
                    }, 2e3);
            })),
        $(document).ready(function () {
            $(".testimonial-carousel").owlCarousel({
                loop: true,
                responsiveClass: true,
                autoplay: true,
                smartSpeed: 1500,
                nav: false,
                dots: true,
                center: false,
                margin: 0,
                responsive: { 0: { items: 1, margin: 0 }, 768: { items: 1 }, 992: { items: 1 }, 1200: { items: 1 } },
            }),
                $(".testimonial-carousel2").owlCarousel({
                    loop: false,
                    responsiveClass: true,
                    autoplay: true,
                    smartSpeed: 1500,
                    nav: false,
                    dots: true,
                    center: false,
                    margin: 50,
                    responsive: { 0: { items: 1, margin: 0 }, 768: { items: 1 }, 992: { items: 1 }, 1200: { items: 2 } },
                }),
                $(".testimonial-carousel3").owlCarousel({
                    loop: true,
                    responsiveClass: true,
                    autoplay: true,
                    smartSpeed: 1500,
                    nav: false,
                    dots: false,
                    thumbs: true,
                    thumbsPrerendered: true,
                    center: false,
                    margin: 50,
                    responsive: { 0: { items: 1, margin: 0 }, 768: { items: 1 }, 992: { items: 1 }, 1200: { items: 1 } },
                }),
                $(".testimonial-carousel6").owlCarousel({
                    loop: false,
                    responsiveClass: true,
                    autoplay: true,
                    smartSpeed: 1500,
                    nav: false,
                    dots: true,
                    center: false,
                    margin: 50,
                    responsive: { 0: { items: 1, margin: 0 }, 768: { items: 1 }, 992: { items: 1 }, 1200: { items: 1 } },
                }),
                $(".feature-carousel").owlCarousel({
                    loop: true,
                    responsiveClass: true,
                    autoplay: true,
                    smartSpeed: 1500,
                    nav: false,
                    dots: true,
                    center: false,
                    margin: 0,
                    responsive: { 0: { items: 1 }, 768: { items: 2 }, 992: { items: 2 }, 1200: { items: 3 } },
                }),
                $(".whychooseus3-carousel").owlCarousel({
                    loop: true,
                    responsiveClass: true,
                    autoplay: true,
                    smartSpeed: 1500,
                    nav: false,
                    dots: true,
                    center: false,
                    margin: 0,
                    responsive: { 0: { items: 1, margin: 0 }, 768: { items: 1 }, 992: { items: 1 }, 1200: { items: 1 } },
                }),
                $(".blog-carousel").owlCarousel({ loop: true, responsiveClass: true, autoplay: false, smartSpeed: 1500, nav: false, dots: true, center: false, margin: 30, items: 1 }),
                $(".slider-fade").owlCarousel({
                    items: 1,
                    loop: true,
                    dots: true,
                    margin: 0,
                    nav: false,
                    navText: ["<i class='ti-angle-left'></i>", "<i class='ti-angle-right'></i>"],
                    autoplay: false,
                    smartSpeed: 1500,
                    mouseDrag: false,
                    animateIn: "fadeIn",
                    animateOut: "fadeOut",
                    responsive: { 992: { nav: true, dots: false } },
                }),
                //$(".owl-carousel").owlCarousel({ items: 1, loop: true, dots: false, margin: 0, autoplay: true, smartSpeed: 1500 }),
                $(".slider-fade").on("changed.owl.carousel", function (e) {
                    e = e.item.index - 2;
                    $("span").removeClass("animated fadeInUp"),
                        $("h1").removeClass("animated fadeInUp"),
                        $("p").removeClass("animated fadeInUp"),
                        $("a").removeClass("animated fadeInUp"),
                        $(".owl-item").not(".cloned").eq(e).find("span").addClass("animated fadeInUp"),
                        $(".owl-item").not(".cloned").eq(e).find("h1").addClass("animated fadeInUp"),
                        $(".owl-item").not(".cloned").eq(e).find("p").addClass("animated fadeInUp"),
                        $(".owl-item").not(".cloned").eq(e).find("a").addClass("animated fadeInUp");
                }),
                0 !== $(".horizontaltab").length &&
                $(".horizontaltab").easyResponsiveTabs({
                    type: "default",
                    width: "auto",
                    fit: true,
                    tabidentify: "hor_1",
                    activate: function (e) {
                        var a = $(this),
                            o = $("#nested-tabInfo");
                        $("span", o).text(a.text()), o.show();
                    },
                }),
                0 !== $(".verticaltab").length &&
                $(".verticaltab").easyResponsiveTabs({
                    type: "vertical",
                    width: "auto",
                    fit: true,
                    closed: "accordion",
                    tabidentify: "hor_1",
                    activate: function (e) {
                        var a = $(this),
                            o = $("#nested-tabInfo2");
                        $("span", o).text(a.text()), o.show();
                    },
                }),
                $(".countup").length && $(".countup").counterUp({ delay: 25, time: 2e3 });
                if ($(".countdown").length) {
                    $(".countdown").countdown({ date: "01 Jan 2024 00:01:00", format: "on" }, function () {});
                }


                ;
        }),
        $window.on("load", function () {
            var a = $(".portfolio-gallery-isotope").isotope({});
            $(".filtering").on("click", "span", function () {
                var e = $(this).attr("data-filter");
                a.isotope({ filter: e });
            }),
                $(".filtering").on("click", "span", function () {
                    $(this).addClass("active").siblings().removeClass("active");
                }),
                $(".portfolio-gallery,.portfolio-gallery-isotope").lightGallery(),
                $window.stellar();
        });
})(jQuery);


$(document).ready(function () {
    "use strict";

    //NavigationMenu();
    //_activeMenu();

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



    //if ($(".map").length > 0) {
    //    google.maps.event.addDomListener(window, "load", initMap);
    //}

    if ($.fn.validate && $("#ContactUs").length) {
    $("#ContactUs").validate({
        rules: {
            name: "required",
            email: {
                required: true,
                email: true
            },
            subject: "required",
            phone: "required",
            message: "required"
        },
        messages: {
            name: "Please enter your name",
            email: "Please enter a valid email address",
            subject: "Please enter a subject",
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


/* google map
================================================== */
// Initialize and add the map
function initMap() {
    var coordinates = {
        lat: 45.39355708828502,
        lng: -75.75104224521027
    };
    var map = new google.maps.Map(document.getElementById('map'), {
        zoom: 15,
        center: coordinates
    });
    var marker = new google.maps.Marker({
        position: coordinates,
        map: map,
        icon: {
            url: "https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi-dotless2.png",
            labelOrigin: new google.maps.Point(90, 28),
            size: new google.maps.Size(27, 43)
        },
        label: {
            text: "Capital Pro Group",
            color: "#C70E20",
            fontWeight: "bold"
        }
    });
}
