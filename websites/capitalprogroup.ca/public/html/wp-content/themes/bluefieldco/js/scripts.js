$(document).ready(function () {
  var dd_wdth = $(window).outerWidth();
  var dd_height = $(window).outerHeight();
  var break_wdth = 769; //Width to Break on Mobile
  var duration = 400;

  //Back To Top
  $(".back-to-top").click(function (event) {
    event.preventDefault();
    $("html, body").animate({ scrollTop: 0 }, duration);
    return false;
  });
  $(window).scroll(function () {
    if (dd_wdth > break_wdth) {
      if ($(this).scrollTop() > 1000) {
        $(".back-to-top").fadeIn(duration);
      } else {
        $(".back-to-top").fadeOut(duration);
      }
    } else {
      if ($(this).scrollTop() > 500) {
        $(".back-to-top").fadeIn(duration);
      } else {
        $(".back-to-top").fadeOut(duration);
      }
    }
  });

  var mySwiper = new Swiper(".mySwiper", {
    spaceBetween: 5,
    slidesPerView: 1,
    navigation: {
      nextEl: ".custom-next",
      prevEl: ".custom-prev",
    },
    autoplay: {
      delay: 3000,
      disableOnInteraction: true,
    },
    breakpoints: {
      640: {
        slidesPerView: 2,
        spaceBetween: 10,
      },
      768: {
        slidesPerView: 3,
        spaceBetween: 20,
      },
      1024: {
        slidesPerView: 4,
        spaceBetween: 30,
        slidesPerGroup: 1,
      },
    },
  });

  $(function () {
    var icons = {
      header: "ui-cutom-icon-plus-e",
      activeHeader: "ui-cutom-icon-minus-s",
    };
    $("#accordion").accordion({
      icons: icons,
      collapsible: true,
    });
  });
  $(function () {
    var icons2 = {
      header: "ui-cutom-icon-plus-e",
      activeHeader: "ui-cutom-icon-minus-s",
    };
    $("#accordion2").accordion({
      icons: icons2,
      collapsible: true,
      heightStyle: "content",
    });
  });
  $(function () {
    var icons3 = {
      header: "ui-cutom-icon-plus-e",
      activeHeader: "ui-cutom-icon-minus-s",
    };
    $("#accordion3").accordion({
      icons: icons3,
      collapsible: true,
      heightStyle: "content",
    });
  });
  $(function () {
    $("#tabs").tabs().addClass("ui-tabs-vertical ui-helper-clearfix");
    $("#tabs li").removeClass("ui-corner-top").addClass("ui-corner-left");
  });
  $(".homeslider").slick({
    slidesToShow: 1,
    slidesToScroll: 1,
    dots: true,
    arrows: false,
    autoplay: true,
    autoplaySpeed: 2000,
  });
  var header = $(".a-header");
  var scrollPositionToActivateClass = 180; // Adjust this value based on your needs

  $(window).scroll(function () {
    if ($(window).scrollTop() > scrollPositionToActivateClass) {
      header.addClass("scrollable");
    } else {
      header.removeClass("scrollable");
    }

    if (isScrolledIntoView1("#expertise")) {
      //$counter = 200;
      $("#expertise .st1").each(function () {
        $(this).addClass("squiggle0");
        //$counter = $counter + 500;
      });
    } else {
      $("#expertise .st1").each(function () {
        $(this).removeClass("squiggle0");
      });
    }
    if (isScrolledIntoView1("#expertise")) {
      $("#expertise .st2").addClass("squiggle1");
      $("#expertise .st3").addClass("squiggle2");
    } else {
      //	$("#expertise .st2").removeClass("squiggle1");
      //	$("#expertise .st3").removeClass("squiggle2");
    }

    if (isScrolledIntoView1("#expertise")) {
      $(".h_expertise-title").each(function () {
        $(this).addClass("squiggleleft");
      });
    } else {
      $(".h_expertise-title").each(function () {
        // $(this).removeClass("squiggleleft");
      });
    }
  });

  // Cache the navigation links
  var navLinks = $(".a-header nav ul li a");

  // Smooth scroll for navigation links
  navLinks.on("click", function (e) {
    e.preventDefault();
    var targetId = $(this).attr("href");
    $("html, body").animate(
      {
        scrollTop: $(targetId).offset().top - 100,
      },
      200
    );

    // Remove 'active' class from all links
    navLinks.removeClass("active");
    // Add 'active' class to the clicked link
    $(this).parent().addClass("active");
  });

  // Scroll spy function
  $(window).scroll(function () {
    var scrollPosition = $(this).scrollTop();

    $(".section").each(function () {
      var sectionTop = $(this).offset().top - 110;
      var sectionBottom = sectionTop + $(this).outerHeight();

      var sectionId = $(this).attr("id");
      var correspondingLink = $('a[href="#' + sectionId + '"]').parent();

      if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
        // Add 'active' class to the corresponding link
        correspondingLink.addClass("active");
      } else {
        // Remove 'active' class from links corresponding to sections not in view
        correspondingLink.removeClass("active");
      }
    });
  });

  // Cache the navigation links
  var menu_barnavLinks = $(".menu_bar ul li a");

  // Smooth scroll for navigation links
  menu_barnavLinks.on("click", function (e) {
    e.preventDefault();
    var targetId = $(this).attr("href");
    $("html, body").animate(
      {
        scrollTop: $(targetId).offset().top - 100,
      },
      200
    );

    // Remove 'active' class from all links
    menu_barnavLinks.removeClass("active");
    // Add 'active' class to the clicked link
    $(this).parent().addClass("active");
  });

  // Scroll spy function
  $(window).scroll(function () {
    var scrollPosition = $(this).scrollTop();

    $(".section").each(function () {
      var sectionTop = $(this).offset().top - 110;
      var sectionBottom = sectionTop + $(this).outerHeight();

      var sectionId = $(this).attr("id");
      var correspondingLink = $('a[href="#' + sectionId + '"]').parent();

      if (scrollPosition >= sectionTop && scrollPosition < sectionBottom) {
        // Add 'active' class to the corresponding link
        correspondingLink.addClass("active");
      } else {
        // Remove 'active' class from links corresponding to sections not in view
        correspondingLink.removeClass("active");
      }
    });
  });
});

document.addEventListener("DOMContentLoaded", function () {
  var breadcrumbs = document.getElementById("breadcrumbs");
  if (breadcrumbs) {
    breadcrumbs.innerHTML = breadcrumbs.innerHTML.replace(" » ", " > ");
  }
});

function isScrolledIntoView1(elem) {
  var docViewTop = $(window).scrollTop();
  var docViewBottom = docViewTop + $(window).height();
  if ($(elem).length > 0) {
    var elemTop = $(elem).offset().top;
    var elemBottom = elemTop + $(elem).height() + 200;
    //console.log("elemBottom-" + elemBottom + "docViewBottom-" + docViewBottom);
    var dd_wdth = $(window).outerWidth();
    return elemBottom <= docViewBottom;
  } else {
    return false;
  }
}

function toggleMobileMenu() {
  var mobileMenu = document.querySelector(".mobile-menu-container");
  mobileMenu.style.display =
    mobileMenu.style.display === "block" ? "none" : "block";
}
