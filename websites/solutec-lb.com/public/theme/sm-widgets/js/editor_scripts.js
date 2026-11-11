(function($) {
	"use strict"; // Start of use strict

	// Document Ready
	$( "document" ).ready(function(){
		
		// Hover Effect
		$('.sm_hover_margin').each(function(){
			$(this).parents('.elementor-widget').addClass('sm_hover_margin_parents')
		});
		
		/* Section Background */
		$('.sm_image_bck').each(function(){
			var image = $(this).attr('data-image');
			var gradient = $(this).attr('data-gradient');
			var color = $(this).attr('data-color');
			var blend = $(this).attr('data-blend');
			var opacity = $(this).attr('data-opacity');
			var position = $(this).attr('data-position');
			var height = $(this).attr('data-height');
			if (image){
				$(this).css('background-image', 'url('+image+')');	
			}
			if (gradient){
				$(this).css('background-image', gradient);	
			}
			if (color){
				$(this).css('background-color', color);	
			}
			if (blend){
				$(this).css('background-blend-mode', blend);	
			}
			if (position){
				$(this).css('background-position', position);	
			}
			if (opacity){
				$(this).css('opacity', opacity);	
			}
			if (height){
				$(this).css('height', height);	
			}

		});



		/* Over */
		$('div[data-over="overlay"]').each(function(){
			var datacolor = $(this).attr('data-over-color');
			$(this).find('.elementor-custom-embed-play').after('<div class="sm_over" data-color="'+datacolor+'">');
		});
		$('.sm_over').each(function(){
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

		// Maps
		setInterval(function($this, $elem){
			$('.sm_map_pin').each(function(){
				var left = $(this).attr('data-left');
				var top = $(this).attr('data-top');
				$(this).css('top', top+'%').css('left', left+'%');
			});
		});


	});// Document Ready End


	

	/**
 	 * @param $scope The Widget wrapper element as a jQuery element
	 * @param $ The jQuery alias
	 */ 

	var WidgetHelloWorldHandler = function( $scope, $ ) {
		console.log( $scope );
	};
	
	// Make sure you run this code under Elementor.
	$( window ).on( 'elementor/frontend/init', function() {
		elementorFrontend.hooks.addAction( 'frontend/element_ready/hello-world.default', WidgetHelloWorldHandler );
	} );


})(jQuery);
