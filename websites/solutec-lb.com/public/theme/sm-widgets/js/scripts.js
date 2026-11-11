(function($) {
	"use strict"; // Start of use strict

	// Document Ready
	$( "document" ).ready(function(){

		// Slider
		$(".man_slider").owlCarousel({
			items:1,
			autoplay:1,
			dots:1,
			nav:1,
			mouseDrag:true,
			animateOut: 'fadeOut',
			loop:true,
			autoHeight:true,
			navText:['<i class="bau_angle"><span></span></i>','<i class="bau_angle"><span></span></i>'],
			responsive:{
		        0:{
		          nav:0
		        },
		        768: {
		        	nav:1
		        },

		    },
		});

		// Video Link
		$('.sm_video_link').on('click',function( event ){
			var url = $(this).attr('href');
	        event.preventDefault();
	        elementorFrontend.utils.lightbox.showModal({
		        url: url,
	        	videoAspectRatio: '169',
		        type: 'video',
	        });
	    });

		// Hover Effect
		$('.man_hover_margin').each(function(){
			$(this).parents('.elementor-widget').addClass('man_hover_margin_parents')
		});



		/* Timeline */

		$('.man_timeline_pin_cont p').each(function(){
			$(this).text($(this).text().substr(0,45));
		});
		$(".man_timeline_carousel").owlCarousel({
			items:4,
			autoplay:0,
			dots:1,
			nav:1,
			navText:['<i class="ti ti-angle-left"></i>','<i class="ti ti-angle-right"></i>'],
			responsiveRefreshRate:200,
			responsive:{
		        0:{
		            items:1,
		        },
		        650:{
		            items:2,
		        },
		        767:{
		            items:3,
		        },
		        1024:{
		            items:4,
		        },
		    }
		});

		// News
		$('.man_news').each(function(){
			var items = $(this).attr('data-items');
			$(this).owlCarousel({
				items:items,
				autoplay:0,
				dots:1,
				nav:0,
				navText:['<i class="ti ti-angle-left"></i>','<i class="ti ti-angle-right"></i>'],
				responsiveRefreshRate:200,
				responsive:{
		        0:{
		            items:1,
		        },
		        767:{
		            items:items,
		        }
		    }
			});
		});

		// News
		$('.man_products_slider').each(function(){
			var items = $(this).attr('data-items');
			$(this).owlCarousel({
				items:items,
				autoplay:0,
				dots:1,
				nav:0,
				navText:['<i class="ti ti-angle-left"></i>','<i class="ti ti-angle-right"></i>'],
				responsiveRefreshRate:200,
				responsive:{
		        0:{
		            items:1,
		        },
		        767:{
		            items:2,
		        },
		        1024:{
		            items:3,
		        },
		        1200:{
		            items:items,
		        }
		    }
			});
		});

		// Prodcuts
		$('.man_vertical_products').each(function(){
			var items = 5;
			$(this).owlCarousel({
				items:items,
				autoplay:0,
				dots:1,
				nav:0,
				navText:['<i class="ti ti-angle-left"></i>','<i class="ti ti-angle-right"></i>'],
				responsiveRefreshRate:200,
				responsive:{
		        0:{
		            items:1,
		        },
		        520:{
		            items:2,
		        },
		        767:{
		            items:items,
		        }
		    }
			});
		});

		var classes = ["product_one", "product_two", "product_three"];
		$('.man_vertical_products .product, .man_vertical_products_default .product').on({

			mouseenter:function(){
				$(this).addClass(classes[~~(Math.random()*classes.length)]);
			},mouseleave:function(){
				$(this).removeClass('product_one');
				$(this).removeClass('product_two');
				$(this).removeClass('product_three');
			}
		});


		$('.man_gallery_slider').each(function(){
			var items = $(this).attr('data-items');
			$(this).find('.gallery').addClass('owl-carousel').owlCarousel({
				items:items,
				autoplay:0,
				dots:0,
				nav:0,
				navText:['<i class="ti ti-angle-left"></i>','<i class="ti ti-angle-right"></i>'],
				responsiveRefreshRate:200,
				responsive:{
		        0:{
		            items:2,
		        },
		        650:{
		            items:3,
		        },
		        767:{
		            items:4,
		        },
		        1024:{
		            items:items,
		        },
		    }
			});
		});


		// Offices
		$('.man_map_pin_cont_mobile_close').on("click", function(){
			$(this).parents('.man_map_pin_cont_mobile').removeClass('active');
		});
		$('.man_map_pin').on("click", function(){
			var id = $(this).attr('data-id');
			$(this).parents('.man_map_pins').find('.man_map_pin_cont_mobile').removeClass('active');
			$(this).parents('.man_map_pins').find('.man_map_pin_cont_mobile-'+id).toggleClass('active');
		});
		$('.man_map').addClass('active');
		$('.man_map_pin').on({
			mouseenter:function(){
				$(this).parents('.man_map').removeClass('active');
			},mouseleave:function(){
			}
		});
		$('.man_map_pin').each(function(){
			var pin_right = $(this).parents('.man_map').width() - $(this).position().left;
				if (pin_right < 200 ) {
					$(this).addClass('man_map_pin_right')
				}
		})


		//Advantages
		$('.man_adv_carousel .man_adv_box_img').each(function(i, el){
			if ( i === 0) {
					$(el).addClass('first-item');
			}
			$(this).insertBefore($(this).parents('.elementor-container'));
		});
		$('.man_adv_box').on({
			mouseenter:function(){
				var box_id = $(this).attr('id');
				$('.man_adv_box_img_'+box_id+'').addClass('active');
			},mouseleave:function(){
				var box_id = $(this).attr('id');
				$('.man_adv_box_img_'+box_id+'').removeClass('active');
			}
		});


		// Testimonials
		$('.man_testimonials').each(function(){
			var items = $(this).attr('data-items');
			var ipad_items = 1;
			$(this).owlCarousel({
				items:items,
				autoplay:0,
				dots:1,
				nav:0,
				navText:['<i class="ti ti-angle-left"></i>','<i class="ti ti-angle-right"></i>'],
				responsiveRefreshRate:200,
				responsive:{
			        0:{
			            items:1,
			            nav:false
			        },
			        767:{
			            items:ipad_items,
			            nav:false
			        },
			        1024:{
			            items:items,
			            nav:false,
			            loop:false
			        }
		        }
			});
		});


		/* Fixed for Parallax */
		$(".man_fixed").css("background-attachment","fixed");


	});// Document Ready End

	$(window).on('load',function(){
		/*SkrollR*/
		if( !device.tablet() && !device.mobile() ) {
			var s = skrollr.init({
				forceHeight: false,
			});
			$(window).stellar({
				horizontalScrolling: false,
				responsive: true,
				verticalOffset: 50
			});
		}
	});



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


(function($) {

  "use strict";
  var previousDevice, _addClass, _doc_element, _find, _handleOrientation, _hasClass, _orientation_event, _removeClass, _supports_orientation, _user_agent;

  previousDevice = window.device;

  window.device = {};

  _doc_element = window.document.documentElement;

  _user_agent = window.navigator.userAgent.toLowerCase();

  device.ios = function() {
    return device.iphone() || device.ipod() || device.ipad();
  };

  device.iphone = function() {
    return _find('iphone');
  };

  device.ipod = function() {
    return _find('ipod');
  };

  device.ipad = function() {
    return _find('ipad');
  };

  device.android = function() {
    return _find('android');
  };

  device.androidPhone = function() {
    return device.android() && _find('mobile');
  };

  device.androidTablet = function() {
    return device.android() && !_find('mobile');
  };

  device.blackberry = function() {
    return _find('blackberry') || _find('bb10') || _find('rim');
  };

  device.blackberryPhone = function() {
    return device.blackberry() && !_find('tablet');
  };

  device.blackberryTablet = function() {
    return device.blackberry() && _find('tablet');
  };

  device.windows = function() {
    return _find('windows');
  };

  device.windowsPhone = function() {
    return device.windows() && _find('phone');
  };

  device.windowsTablet = function() {
    return device.windows() && _find('touch');
  };

  device.fxos = function() {
    return (_find('(mobile;') || _find('(tablet;')) && _find('; rv:');
  };

  device.fxosPhone = function() {
    return device.fxos() && _find('mobile');
  };

  device.fxosTablet = function() {
    return device.fxos() && _find('tablet');
  };

  device.meego = function() {
    return _find('meego');
  };

  device.cordova = function() {
    return window.cordova && location.protocol === 'file:';
  };

  device.mobile = function() {
    return device.androidPhone() || device.iphone() || device.ipod() || device.windowsPhone() || device.blackberryPhone() || device.fxosPhone() || device.meego();
  };

  device.tablet = function() {
    return device.ipad() || device.androidTablet() || device.blackberryTablet() || device.windowsTablet() || device.fxosTablet();
  };

  device.desktop = function() {
    return !device.tablet() && !device.mobile();
  };

  device.portrait = function() {
    return (window.innerHeight / window.innerWidth) > 1;
  };

  device.landscape = function() {
    return (window.innerHeight / window.innerWidth) < 1;
  };

  device.noConflict = function() {
    window.device = previousDevice;
    return this;
  };

  _find = function(needle) {
    return _user_agent.indexOf(needle) !== -1;
  };

  _hasClass = function(class_name) {
    var regex;
    regex = new RegExp(class_name, 'i');
    return _doc_element.className.match(regex);
  };

  _addClass = function(class_name) {
    if (!_hasClass(class_name)) {
      return _doc_element.className += " " + class_name;
    }
  };

  _removeClass = function(class_name) {
    if (_hasClass(class_name)) {
      return _doc_element.className = _doc_element.className.replace(class_name, "");
    }
  };

  if (device.ios()) {
    if (device.ipad()) {
      _addClass("ios ipad tablet");
    } else if (device.iphone()) {
      _addClass("ios iphone mobile");
    } else if (device.ipod()) {
      _addClass("ios ipod mobile");
    }
  } else if (device.android()) {
    if (device.androidTablet()) {
      _addClass("android tablet");
    } else {
      _addClass("android mobile");
    }
  } else if (device.blackberry()) {
    if (device.blackberryTablet()) {
      _addClass("blackberry tablet");
    } else {
      _addClass("blackberry mobile");
    }
  } else if (device.windows()) {
    if (device.windowsTablet()) {
      _addClass("windows tablet");
    } else if (device.windowsPhone()) {
      _addClass("windows mobile");
    } else {
      _addClass("desktop");
    }
  } else if (device.fxos()) {
    if (device.fxosTablet()) {
      _addClass("fxos tablet");
    } else {
      _addClass("fxos mobile");
    }
  } else if (device.meego()) {
    _addClass("meego mobile");
  } else {
    _addClass("desktop");
  }

  if (device.cordova()) {
    _addClass("cordova");
  }

  _handleOrientation = function() {
    if (device.landscape()) {
      _removeClass("portrait");
      return _addClass("landscape");
    } else {
      _removeClass("landscape");
      return _addClass("portrait");
    }
  };

  _supports_orientation = "onorientationchange" in window;

  _orientation_event = _supports_orientation ? "orientationchange" : "resize";

  if (window.addEventListener) {
    window.addEventListener(_orientation_event, _handleOrientation, false);
  } else if (window.attachEvent) {
    window.attachEvent(_orientation_event, _handleOrientation);
  } else {
    window[_orientation_event] = _handleOrientation;
  }

  _handleOrientation();

}).call(this);
