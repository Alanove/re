lw.AppendInit(function () {


	var lwSite = function () {
		// We extend jQuery by method hasAttr
		$.fn.hasAttr = function (name) {
			return this.attr(name) !== undefined;
		};

		// Fixed Header
		function handleHeader() {

			var $offset = $("header").height() + 8;

			// jQuery for page scrolling feature - requires jQuery Easing plugin
			$('.pagescroll').bind('click', function (event) {
				var $position = 0;

				var _url = $(this).attr('href').split("/");

				if (_url[1] != '#home')
					$position = $(_url[1]).offset().top;

				$('html, body').stop().animate({
					scrollTop: $position - $offset
				}, 600);
				event.preventDefault();
			});

			var $scrollspy = $('body').scrollspy({ target: '.nav', offset: $offset + 2 });

			// Collapse Navbar When It's Clicked
			$(window).scroll(function () {
				$('.navbar-collapse.in').collapse('hide');
			});
		}

		return {
			siteinit: function () {
				//handleHeader();
			},

		};

	}();

	// Adds browser version on html class.
	//$.browserSelector();

	// Adds window smooth scroll on chrome.
	if ($("html").hasClass("chrome")) {
	//	$.smoothScroll();
	}

	$(window).resize(function () {
		// handleMenu();
	});

	/*----------------------------------------------------*/
    /*  Scroll To Top Section
    /*----------------------------------------------------*/


	$(window).scroll(function () {
		if ($(this).scrollTop() > 50) {
			$('#back-to-top').fadeIn();
		} else {
			$('#back-to-top').fadeOut();
		}
	});

	// scroll body to 0px on click
	$('#back-to-top').click(function () {
		$('#back-to-top').tooltip('hide');
		$('body,html').animate({
			scrollTop: 0
		}, 800);
		return false;
	});

	$(".navbar-collapse > div > ul > li > ul").each(function () {
		var _ = $(this);
		var a = _.parent().children('a');
		a.addClass("dropdown-toggle");
		a.attr("data-toggle", "dropdown");
		_.addClass("dropdown-menu");
		_.removeClass("dropdown");
		_.parent().addClass("dropdown");
		_.children('li').children('a').removeClass("nav-link");
		_.children('li').children('a').addClass("dropdown-item");
	});


	$("ul.nav").addClass("d-flex");

	handleMenu();
	lwSite.siteinit();



	if ($("#rev_slider_1").length > 0) {
		RevolutionSlider.initRSfullWidth();
	}
	// SlickCarousel.initSlickCarousel();
	// OwlCarousel.initOwlCarousel();
	//OwlCarousel.initOwlCarousel2();
	//OwlCarousel.initOwlCarousel3();
	//OwlCarousel.initOwlCarousel4();
	//ParallaxBg.initParallaxBg();



	// start adding class to active menu

	var url = window.location.pathname;

	var x = url.split('/');
	if (x.length > 1) {
		$('.header-top-menu a[href$="' + x[1] + '"]').parent().addClass('active');
		$('.nav a[href$="' + x[1] + '"]').parent().addClass('current');
	} if (x.length > 2) {
		$('.header-top-menu a[href$="' + x[2] + '"]').parent().addClass('active');
	} if (x.length > 3) {
		$('.header-top-menu a[href$="' + x[3] + '"]').parent().addClass('active');
	}

	var parent = $('.menu a[href$="' + url + '"]').parent();
	parent.each(function () {
		var _ = $(this);
		if (!_.hasClass('current')) {
			_.addClass('current');
		}
	});

	// end adding class to active menu


	if ($(".galleryContainer #albums").length > 0) {
		ImageGallery();
	}


	if ($(".galleryContainer #grid-container").length > 0) {
		ListImageGallery();
	}

});

lw.AppendLoad(function () {
	//var audio = new Audio('./intro.mp3');
	//audio.currentTime = 0;
	//audio.play();

	//var sound = document.getElementById("audioId");
	//sound.currentTime = 0;
	//sound.loop = true; //if you want it to restart playing automatically when it ends
	//sound.play();
});


function handleMenu() {

	// Add slideDown animation to dropdown
	$('nav .dropdown').on('show.bs.dropdown', function (e) {
		if ($(window).width() < 992) {
			$(this).find('.dropdown-menu').first().stop(true, true).slideDown(300);
		}
	});

	// Add slideUp animation to dropdown
	$('nav .dropdown').on('hide.bs.dropdown', function (e) {
		if ($(window).width() < 992) {
			$(this).find('.dropdown-menu').first().stop(true, true).slideUp(300, function () {
				$(this).removeAttr('style');
			});
		}
	});
}

// Parallax Backgrounds
var ParallaxBg = function () {

	return {
		// Parallax Backgrounds
		initParallaxBg: function () {
			jQuery(window).load(function () {
				jQuery('.parallaxBg').parallax("50%", 0.2);
			});
		}
	};
}();

var OwlCarousel = function () {

	return {
		initOwlCarousel: function () {
			var owl = jQuery(".owl-carousel").owlCarousel({
				loop: true,
				nav: true,
				margin: 20,
				dots: false,
				navText: ['<i class="fa fa-chevron-left" aria-hidden="true"></i>', '<i class="fa fa-chevron-right" aria-hidden="true"></i>'],
				responsiveClass: true,
				responsive: {
					0: {
						items: 1
					},
					425: {
						items: 2
					},
					768: {
						items: 3
					},
					992: {
						items: 4,
						loop: false
					}
				}
			});
		},

		initOwlCarousel2: function () {
			var owl = jQuery(".owl-carousel").owlCarousel({
				// center: true,
				loop: false,
				nav: true,
				margin: 20,
				dots: false,
				navText: ['<i class="fa fa-chevron-left" aria-hidden="true"></i>', '<i class="fa fa-chevron-right" aria-hidden="true"></i>'],
				responsiveClass: true,
				responsive: {
					0: {
						items: 1
					},
					425: {
						items: 2
					},
					768: {
						items: 4
					},
					992: {
						items: 4
					}
				}
			});
		},

		initOwlCarousel3: function () {
			var owl = jQuery(".products .owl-carousel").owlCarousel({
				items: 3,
				responsive: {
					0: {
						items: 1
					},
					600: {
						items: 2
					},
					900: {
						items: 3
					},
					1000: {
						items: 3
					}
				},
				slideSpeed: 700,
				nav: true,
				margin: 20,
				navText: ['<i class="fa fa-angle-left"></i>', '<i class="fa fa-angle-right"></i>']
			});
		},

		initOwlCarousel4: function () {
			var owl = jQuery(".services .owl-carousel").owlCarousel({
				items: 3,
				responsive: {
					0: {
						items: 1
					},
					600: {
						items: 2
					},
					900: {
						items: 3
					},
					1000: {
						items: 3
					}
				},
				slideSpeed: 700,
				nav: true,
				margin: 20,
				navText: ['<i class="fa fa-angle-left"></i>', '<i class="fa fa-angle-right"></i>']
			});
		}
	};

}();

var RevolutionSlider = function () {

	return {

		//Revolution Slider - Full Width
		initRSfullWidth: function () {
			var revapi;
			jQuery(document).ready(function () {
				revapi = jQuery('#rev_slider_1').show().revolution(
					{
						sliderLayout: 'fullwidth',
						delay: 4500,

						/* basic navigation arrows and bullets */
						navigation: {

							arrows: {
								enable: true,
								style: 'hesperiden'
							}
						}
					});
			});
		}
	};
}();

var SlickCarousel = function () {
	return {
		initSlickCarousel: function () {
			$('.testimonials').slick({
				infinite: true
			});
		}
	};
}();



function ImageGallery() {

	var gridContainer = $('.galleryContainer #albums');


    /*********************************
     init cubeportfolio
     *********************************/
	gridContainer.cubeportfolio({
		layoutMode: 'grid',
		rewindNav: true,
		scrollByPage: true,
		mediaQueries: [{
			width: 480,
			cols: 3
		}, {
			width: 340,
			cols: 2
		}],
		defaultFilter: '*',
		animationType: 'rotateSides',
		gapHorizontal: 10,
		gapVertical: 10,
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

function ListImageGallery() {

	var gridContainer = $('.galleryContainer #grid-container');


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
		gapHorizontal: 10,
		gapVertical: 10,
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

var requestInterval = function (fn, delay) {
	var requestAnimFrame = (function () {
		return window.requestAnimationFrame || function (callback, element) {
			window.setTimeout(callback, 1000 / 60);
		};
	})(),
		start = new Date().getTime(),
		handle = {};
	function loop() {
		handle.value = requestAnimFrame(loop);
		var current = new Date().getTime(),
			delta = current - start;
		if (delta >= delay) {
			fn.call();
			start = new Date().getTime();
		}
	}
	handle.value = requestAnimFrame(loop);
	return handle;
};

///Top Marquee script
lw.AppendInit(function () {
	function start_marquee() {
		function go() {
			i = i < width ? i + step : 1;
			m.style.marginTop = -i + 'px';
		}
		var i = 0,
			step = 1,
			space = '<BR><BR><BR><BR>';
		var m = $('.marquee')[0];
		var t = m.innerHTML; //text
		m.innerHTML = t + space;
		m.style.position = 'absolute'; // http://stackoverflow.com/questions/2057682/determine-pixel-length-of-string-in-javascript-jquery/2057789#2057789
		var width = (m.clientHeight + 1);
		m.style.position = '';
		m.innerHTML = t + space + t + space + t + space + t + space + t + space + t + space + t + space;
		if (m.addEventListener) {
			m.addEventListener('mouseenter', function () {
				step = 0;
			}, false);
			m.addEventListener('mouseleave', function () {
				step = 1;
			}, false);
		}
		var x = requestInterval(go, 15);
	}

	if ($(".marquee").length > 0) {
		start_marquee();
	}
});