jQuery(document).ready(function($) {
	// We only want these styles applied when javascript is enabled
	$('div.content').css('display', 'block');

	// Initially set opacity on thumbs and add
	// additional styling for hover effect on thumbs
	var onMouseOutOpacity = 0.67;
	$('#thumbs ul.thumbs li, div.navigation a.pageLink').opacityrollover({
		mouseOutOpacity:   onMouseOutOpacity,
		mouseOverOpacity:  1.0,
		fadeSpeed:         'fast',
		exemptionSelector: '.selected'
	});
	var tmpDelay = 1000;
	tmpDelay = $('#delaytime').text();
	
	if(tmpDelay > 0) {
		tmpDelay = tmpDelay;
	}
	else {
		tmpDelay = 5;
	}
	tmpDelay = tmpDelay * 1000;

	
	// Initialize Advanced Galleriffic Gallery
	var gallery = $('#thumbs').galleriffic({
		delay:                     tmpDelay,
		numThumbs:                 8,
		preloadAhead:              4,
		enableTopPager:            false,
		enableBottomPager:         false,
		imageContainerSel:         '#slideshow',
		controlsContainerSel:      '#controls',
		captionContainerSel:       '#caption',
		loadingContainerSel:       '#loading',
		renderSSControls:          true,
		renderNavControls:         true,
		playLinkText:              'Play Slideshow',
		pauseLinkText:             'Pause Slideshow',
		prevLinkText:              '&lsaquo; Previous Photo',
		nextLinkText:              'Next Photo &rsaquo;',
		nextPageLinkText:          'Next &rsaquo;',
		prevPageLinkText:          '&lsaquo; Prev',
		enableHistory:             false,
		enableKeyboardNavigation:  false,
		autoStart:                 true,
		syncTransitions:           true,
		defaultTransitionDuration: 900,
		onSlideChange:             function(prevIndex, nextIndex) {
			// 'this' refers to the gallery, which is an extension of $('#thumbs')
			this.find('ul.thumbs').children()
				.eq(prevIndex).fadeTo('fast', onMouseOutOpacity).end()
				.eq(nextIndex).fadeTo('fast', 1.0);

			// Update the photo index display
			this.$captionContainer.find('div.photo-index')
				.html('Photo '+ (nextIndex+1) +' of '+ this.data.length);
		},
		onPageTransitionOut:       function(callback) {
			this.fadeTo('fast', 0.0, callback);
		},
		onPageTransitionIn:        function() {
			var prevPageLink = this.find('a.prev').css('visibility', 'hidden');
			var nextPageLink = this.find('a.next').css('visibility', 'hidden');
			
			// Show appropriate next / prev page links
			if (this.displayedPage > 0)
				prevPageLink.css('visibility', 'visible');

			var lastPage = this.getNumPages() - 1;
			if (this.displayedPage < lastPage)
				nextPageLink.css('visibility', 'visible');

			this.fadeTo('fast', 1.0);
		}
	});

	/**************** Event handlers for custom next / prev page links **********************/

	gallery.find('a.prev').click(function(e) {
		gallery.previousPage();
		gallery.play();
		e.preventDefault();
	});

	gallery.find('a.next').click(function(e) {
		gallery.nextPage();
		gallery.play();
		e.preventDefault();
	});
	
	/**************** Event handlers for click of a thumbnail **********************/
	gallery.find('ul.thumbs li a').click(function(e) {
		gallery.play();
		e.preventDefault();
	});
});
	
