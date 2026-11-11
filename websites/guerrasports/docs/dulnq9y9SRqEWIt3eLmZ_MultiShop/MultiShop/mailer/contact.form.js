(function ($) {
    "use strict";

    $("#contactForm input, #contactForm textarea").jqBootstrapValidation({
        preventSubmit: true,
        submitError: function ($form, event, errors) {},
        submitSuccess: function ($form, event) {
            event.preventDefault();

            // Collect form data
            var formData = {
                name: $("#name").val().trim(),
                email: $("#email").val().trim(),
                subject: $("#subject").val().trim(),
                message: $("#message").val().trim(),
                mobile: $("#mobile").length ? $("#mobile").val().trim() : ""
            };

            var $btn = $("#sendMessageButton");
            var $btnText = $btn.find("span");
            var $btnSpinner = $btn.find("div");

            // Button loading state
            $btn.prop("disabled", true);
            $btnText.text("Sending...");
            $btnSpinner.removeClass("d-none");

            // Clear previous alerts
            $("#alertMessage").html("");

            // AJAX call
            $.ajax({
                url: "mailer/contact.form.php",
                type: "POST",
                data: formData,
                dataType: "json",
                timeout: 15000, // 15 seconds
                success: function (response) {
                    var html = "";
                    if (response.status === "success") {
                        html = '<div class="alert alert-success alert-dismissible fade show" role="alert">' +
                               '<strong>' + response.message + '</strong>' +
                               '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>' +
                               '</div>';
                        $("#contactForm").trigger("reset");
                    } else {
                        html = '<div class="alert alert-danger alert-dismissible fade show" role="alert">' +
                               '<strong>' + response.message + '</strong>' +
                               '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>' +
                               '</div>';
                    }
                    $("#alertMessage").html(html);
                },
                error: function (xhr, textStatus) {
                    var errorMsg = "Ajax Error: Unable to reach the mail server.";
                    if (textStatus === "timeout") errorMsg = "Request timed out. Please try again.";
                    if (xhr.status === 404) errorMsg = "Mailer file not found (404).";
                    if (xhr.status === 500) errorMsg = "Internal server error (500).";

                    var html = '<div class="alert alert-danger alert-dismissible fade show" role="alert">' +
                               '<strong>' + errorMsg + '</strong>' +
                               '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>' +
                               '</div>';
                    $("#alertMessage").html(html);
                },
                complete: function () {
                    // Reset button state
                    $btn.prop("disabled", false);
                    $btnText.text("Send Message");
                    $btnSpinner.addClass("d-none");
                }
            });
        }
    });

    // Clear alert on input focus
    $("#contactForm input, #contactForm textarea").on("focus", function () {
        $("#alertMessage").html("");
    });

})(jQuery);
