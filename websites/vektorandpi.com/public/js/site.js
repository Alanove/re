lw.AppendInit(function () {


	var lwSite = function () {

		return {
			siteinit: function () {

			}

		};

	}();


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

	lwSite.siteinit();
	_activeMenu();

	$('a[data-toggle="tab"]').on('shown.bs.tab', function (e) {

		$('a[data-toggle="tab"]').each(function (index, value) {
			var _id = `${this.id}`;
			if (e.target.id != _id) {
				$(this).parent().addClass('not-selected');
			} else {
				$(this).parent().removeClass('not-selected');
			}
		});
		//e.target // newly activated tab
		//e.relatedTarget // previous active tab
	});

	function showServiceTab(hash) {
		var $tabs = $('a[data-toggle="tab"]');
		if (!$tabs.length) {
			return;
		}
		var $tab = hash ? $tabs.filter('[href="' + hash + '"]') : $();
		if (!$tab.length) {
			$tab = $tabs.first();
		}
		if ($tab.hasClass('active') && $($tab.attr('href')).hasClass('show')) {
			return;
		}
		if (typeof $.fn.tab === 'function') {
			$tab.tab('show');
			return;
		}
		$tabs.removeClass('active').attr('aria-selected', 'false');
		$('.tab-pane').removeClass('active show');
		$tab.addClass('active').attr('aria-selected', 'true');
		var target = $tab.attr('href');
		if (target) {
			$(target).addClass('active show');
		}
	}

	// Bootstrap cancels the link, so a click must push the hash itself.
	// Back and forward then fire popstate and the matching tab is shown.
	$('a[data-toggle="tab"]').on('click', function () {
		var hash = $(this).attr('href');
		if (!hash || hash.charAt(0) !== '#' || window.location.hash === hash) {
			return;
		}
		window.history.pushState({ tab: hash }, '', hash);
	});

	setTimeout(function () {
		showServiceTab(window.location.hash);
	}, 0);
	window.addEventListener('popstate', function () {
		showServiceTab(window.location.hash);
	});

	if ($(".pop-up").length > 0) {
		setPopupHeight();
	}

	if ($(".galleryContainer #albums").length > 0) {
		ImageGallery();
	}

	if ($(".scrollbar-inner").length > 0) {
		$(".scrollbar-inner").mCustomScrollbar({
			disableBodyScroll: true
		});
	}

	if ($(".galleryContainer #testimonials").length > 0) {
		TestimonialsGallery();
	}

	if ($(".galleryContainer #clients").length > 0) {
		ClientsGallery();
	}

	$(window).resize(function () {

		if ($(".pop-up").length > 0) {
			setPopupHeight();
		}
	});

	$('.gallery').click(function () {
		$('.pop-up-gallery').addClass('show');
	});

	$('.close-popup-gallery').click(function () {
		$('.pop-up-gallery').removeClass('show');
	});



	$('.testimonials').click(function () {
		$('.pop-up-testimonials').addClass('show');
	});

	$('.close-popup-testimonials').click(function () {
		$('.pop-up-testimonials').removeClass('show');
	});



	$('.clients').click(function () {
		$('.pop-up-clients').addClass('show');
	});

	$('.close-popup-clients').click(function () {
		$('.pop-up-clients').removeClass('show');
	});

});


$(window).load(function () {
	setTimeout(function () {
		$('#preloader').fadeOut('slow', function () {
			$(this).remove();
			//	$(location).attr('href', 'home');
		});
	}, 500);


});

function setPopupHeight() {
	var _h = $(window).height();
	$(".pop-up").height(_h - 200);
}

function _activeMenu() {

	var url = window.location.pathname,
		urlRegExp = new RegExp(url === '/' ? window.location.origin + '/?$' : url.replace(/\/$/, ''));

	var x = url.split('/');
	if (x.length > 1) {
		$('.mainMenu a[href$="' + decodeURI(x[1]) + '"]').addClass('active');

		if ($('.fullCircles').length > 0) {
			if (x[1] != "") {
				$('.fullCircles .' + x[1]).addClass('selected');
			}
		}
	}


}

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
			width: 680,
			cols: 5
		}, {
			width: 480,
			cols: 4
		}, {
			width: 340,
			cols: 2
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

function TestimonialsGallery() {

	var gridContainer = $('.galleryContainer #testimonials');


	/*********************************
	 init cubeportfolio
	 *********************************/
	gridContainer.cubeportfolio({
		layoutMode: 'grid',
		rewindNav: true,
		scrollByPage: true,
		mediaQueries: [{
			width: 680,
			cols: 3
		}, {
			width: 480,
			cols: 2
		}, {
			width: 340,
			cols: 2
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

function ClientsGallery() {

	var gridContainer = $('.galleryContainer #clients');


	/*********************************
	 init cubeportfolio
	 *********************************/
	gridContainer.cubeportfolio({
		layoutMode: 'grid',
		rewindNav: true,
		scrollByPage: true,
		mediaQueries: [{
			width: 680,
			cols: 5
		}, {
			width: 480,
			cols: 4
		}, {
			width: 340,
			cols: 2
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