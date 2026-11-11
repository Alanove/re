var $ = $.noConflict();
$(document).ready(function () {
    "use strict";
    if ($('.scrollReveal').length && !$('html.ie9').length) {
        $('.scrollReveal').parent().css('overflow', 'hidden');
        window.sr = ScrollReveal({
            reset: true,
            distance: '32px',
            mobile: false,
            duration: 850,
            scale: 1,
            viewFactor: 0.3,
            easing: 'ease-in-out'
        });
        sr.reveal('.sr-top', {origin: 'top'});
        sr.reveal('.sr-bottom', {origin: 'bottom'});
        sr.reveal('.sr-left', {origin: 'left'});
        sr.reveal('.sr-long-left', {origin: 'left', distance: '70px', duration: 1000});
		sr.reveal('.sr-long-right', {origin: 'right', distance: '70px', duration: 1000});
        sr.reveal('.sr-right', { origin: 'right' });
        sr.reveal('.sr-scaleUptitle', { scale: '0.9', duration: 800 });
        sr.reveal('.sr-scaleUp', { scale: '0.9', duration: 900 });
		sr.reveal('.sr-scaleUpportfolio', { scale: '0.95', duration: 1000 });
        sr.reveal('.sr-scaleDown', {scale: '1.08', duration: 900});
		sr.reveal('.sr-scaleDownVideo', {scale: '1.09', duration: 1000});
        
	
        sr.reveal('.sr-delay-title', { delay: 200 });  
        sr.reveal('.sr-delay-1', {delay: 200});
        sr.reveal('.sr-delay-2', {delay: 300});
        sr.reveal('.sr-delay-3', {delay: 400});
        sr.reveal('.sr-delay-4', {delay: 500});
        sr.reveal('.sr-delay-5', {delay: 600});
        sr.reveal('.sr-delay-6', {delay: 700});
        sr.reveal('.sr-delay-7', {delay: 800});
        sr.reveal('.sr-delay-8', {delay: 900});
		sr.reveal('.sr-delay-9', {delay: 1000});
		sr.reveal('.sr-delay-10', { delay: 1100 });
		sr.reveal('.sr-delay-11', { delay: 1200 });
		sr.reveal('.sr-delay-12', { delay: 1300 });


		sr.reveal('.sr-delay-p01', { delay: 100 });
		sr.reveal('.sr-delay-p1', { delay: 300 });

		sr.reveal('.sr-delay-p02', { delay: 400 });
		sr.reveal('.sr-delay-p2', { delay: 600 });

		sr.reveal('.sr-delay-p03', { delay: 700 });
		sr.reveal('.sr-delay-p3', { delay: 900 });

		sr.reveal('.sr-delay-p04', { delay: 1000 });
		sr.reveal('.sr-delay-p4', { delay: 1200 });

		sr.reveal('.sr-delay-p05', { delay: 1200 });
		sr.reveal('.sr-delay-p5', { delay: 1500 });

		sr.reveal('.sr-delay-p06', { delay: 1600 });
		sr.reveal('.sr-delay-p6', { delay: 1800 });

		
        sr.reveal('.sr-ease-in-out-quad', {easing: 'cubic-bezier(0.455,  0.030, 0.515, 0.955)'});
        sr.reveal('.sr-ease-in-out-cubic', {easing: 'cubic-bezier(0.645,  0.045, 0.355, 1.000)'});
        sr.reveal('.sr-ease-in-out-quart', {easing: 'cubic-bezier(0.770,  0.000, 0.175, 1.000)'});
        sr.reveal('.sr-ease-in-out-quint', {easing: 'cubic-bezier(0.860,  0.000, 0.070, 1.000)'});
        sr.reveal('.sr-ease-in-out-sine', {easing: 'cubic-bezier(0.445,  0.050, 0.550, 0.950)'});
        sr.reveal('.sr-ease-in-out-expo', {easing: 'cubic-bezier(1.000,  0.000, 0.000, 1.000)'});
        sr.reveal('.sr-ease-in-out-circ', {easing: 'cubic-bezier(0.785,  0.135, 0.150, 0.860)'});
        sr.reveal('.sr-ease-in-out-back', {easing: 'cubic-bezier(0.680, -0.550, 0.265, 1.550)'});
    }
});


