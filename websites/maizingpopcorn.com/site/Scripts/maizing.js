$(window).on("scroll", function () {
	if ($("#Flavors").offset().top - $(window).scrollTop() <= 0)
		$(".nav-bar-container").addClass("sand");
	else
		$(".nav-bar-container").removeClass("sand");

});

$(document).ready(function () {
	$('.js-year').text(new Date().getFullYear());

	var $root = $('html, body');

	$('a[href^="#"]').click(function () {
		var href = $.attr(this, 'href');

		$root.animate({
			scrollTop: $(href).offset().top
		}, 500, function () {
			window.location.hash = href;
		});


		$('.navbar-collapse').removeClass('show');

		return false;
	});


	$("#ContactForm").submit(function (e) {
		e.preventDefault();

		var form = $(this);
		var name = String(form.find('[name="Name"]').val() || '').trim();
		var email = String(form.find('[name="Email"]').val() || '').trim();
		var phone = String(form.find('[name="Phone"]').val() || '').trim();
		var message = String(form.find('[name="Message"]').val() || '').trim();

		var body = [
			'Name: ' + name,
			'Email: ' + email,
			'Phone: ' + phone,
			'',
			message
		].join('\r\n');

		var mailto =
			'mailto:info@maizingpopcorn.com' +
			'?subject=' + encodeURIComponent('Maizing Popcorn contact') +
			'&body=' + encodeURIComponent(body);

		window.location.href = mailto;
	});
});
