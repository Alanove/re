(function($) {
	"use strict"; // Start of use strict

	/* Section Background */
	$('.man_image_bck').each(function(){
		var image = $(this).attr('data-image');
		var gradient = $(this).attr('data-gradient');
		var color = $(this).attr('data-color');
		var repeat = $(this).attr('data-repeat');
		var position = $(this).attr('data-position');
		var attachment = $(this).attr('data-attachment');
		var size = $(this).attr('data-size');
		if (image){
			$(this).css('background-image', 'url('+image+')');
		}
		if (gradient){
			$(this).css('background-image', gradient);
		}
		if (color){
			$(this).css('background-color', color);
		}
		if (repeat){
			$(this).css('background-repeat', repeat);
		}
		if (position){
			$(this).css('background-position', position);
		}
		if (attachment){
			$(this).css('background-attachment', attachment);
		}
		if (size){
			$(this).css('background-size', size);
		}
	});

	// Pages
	$('.page-links').each(function(){
		$('<div class="clearfix"></div>').insertBefore(this)
	})

	// Search
	$('.man_search_block').on("click", function(e){
		$(this).next('.man_search_block_bg').toggleClass('active');
	});
	$('.man_search_block_bg_close').on("click", function(e){
		$(this).parents('.man_search_block_bg').toggleClass('active');
	});

	// Empty Menu
	$('.menu a').each(function(){
		var link_text = $(this).text();
		if (link_text =='') {
			$(this).addClass('empty');
		}
	})

	/* Over */
	$('div[data-over="overlay"]').each(function(){
		var datacolor = $(this).attr('data-over-color');
		$(this).find('.elementor-custom-embed-play').after('<div class="man_over" data-color="'+datacolor+'">');
	});
	$('.man_over').each(function(){
		var color = $(this).attr('data-color');
		var image = $(this).attr('data-image');
		var opacity = $(this).attr('data-opacity');
		var blend = $(this).attr('data-blend');
		var gradient = $(this).attr('data-gradient');
		if (gradient){
			$(this).css('background-image', gradient);
		}
		if (color){
			$(this).css('background-color', color);
		}
		if (image){
			$(this).css('background-image', 'url('+image+')');
		}
		if (opacity){
			$(this).css('opacity', opacity);
		}
		if (blend){
			$(this).css('mix-blend-mode', blend);
		}
	});

	//Enquiry

  if ( document.location.href.indexOf('#wpforms') > -1 ) {
	  $( ".enquiry_tab a" ).trigger( "click" );
  }

  // Clear Btackets
  $('.woocommerce-widget-layered-nav-list .count, .cat-item .count').each( function() {
		$(this).html( /(\d+)/g.exec( $(this).html() )[0] );
	} );

  // Menu
  $('.sm_menu').each(function(){
  	$(this).parents('section').css('z-index','10')
  });
	/* Mobile Menu */
	if( device.tablet() || device.mobile() ) {
		$('.sm_nav_menu .menu-item-has-children, .sm_nav_menu .page_item_has_children').on("click", function(e){
			$(this).find('.sub-menu').slideToggle(0);
			$(this).find('.mega-menu').find('ul').slideToggle(0);
			$(this).find('.children').slideToggle(0);
		});
	}
	$('.sm_menu_toggle').on("click", function(e){
		$(this).toggleClass('active');
		$(this).parents('body').toggleClass('menu_active');
	});
	$('.sm_menu_toggle_close').on("click", function(e){
		$(this).toggleClass('active');
		$(this).parents('body').toggleClass('menu_active');
	});

	// Enquiry scroll
	$(document).ready(function(){
		if(window.location.href.indexOf('#') >= 0) {
			var link = window.location.href.substr(window.location.href.indexOf('#'));
			$(link+' a' ).trigger( "click" );
			var anchor = $(this);
			$('html, body').stop().animate({
				scrollTop: $(anchor.attr('href')).offset().top - 60
			}, 500);
		}
	});

  // Enquiry Button
  $('.man_enquiry_btn').on("click", function(e){
  		var link = $(this).attr('href');
		$(link+' a' ).trigger( "click" );
		var anchor = $(this);
		$('html, body').stop().animate({
			scrollTop: $(anchor.attr('href')).offset().top - 60
		}, 500);
		e.preventDefault();
	});

	$(window).on('load',function(){
			// Page loader
	    $(".preloader").fadeOut("slow");

	});

	$('.stm-view-by').on('click', '.view-type', function(e){
		e.preventDefault();
		$('.stm-view-by .view-type').removeClass('active');
		$(this).addClass('active');
		$('.stm-products-main').removeClass('grid').removeClass('list');
		$('.stm-products-main').addClass($(this).data('view'));
	});

	$(document).on("click", '.product-categories .toggle', function() {
		$(this).parents('.cat-item').toggleClass('active');
	});

	$(document).on("click", '.stm-checkbox-list li input', function() {
		var list = [];
		$('.stm-checkbox-list li input:checkbox:checked').each(function () {
			list.push($(this).val());
		});
		$('#stm_brands').val(list.join(','));
		$('#stm_brands').parents('form').submit();
	});

	$(document).ready(function(){
		$('.product-categories > li').each(function(){
			 $(this).prepend('<i class="toggle"></i>');
		});
	});

})(jQuery);
