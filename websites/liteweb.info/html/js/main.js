(function () {
  "use strict";

  var body = document.body;
  var header = document.querySelector(".site-header");
  var menuBtn = document.querySelector("[data-drawer-open]");
  var closeBtn = document.querySelector("[data-drawer-close]");
  var overlay = document.querySelector("[data-drawer-overlay]");
  var drawer = document.querySelector("[data-drawer]");
  var dropdown = document.querySelector("[data-products-dropdown]");
  var dropdownTrigger = document.querySelector("[data-products-trigger]");
  var dropdownMenu = document.querySelector("[data-products-menu]");
  var accordionTrigger = document.querySelector("[data-products-accordion]");
  var accordionPanel = document.querySelector("[data-products-panel]");
  var progressBar = document.querySelector("[data-reading-progress]");

  function openDrawer() {
    if (!drawer || !overlay) return;
    drawer.classList.add("is-open");
    overlay.classList.add("is-open");
    body.classList.add("is-locked");
    if (menuBtn) menuBtn.setAttribute("aria-expanded", "true");
    if (closeBtn) closeBtn.focus();
  }

  function closeDrawer() {
    if (!drawer || !overlay) return;
    drawer.classList.remove("is-open");
    overlay.classList.remove("is-open");
    body.classList.remove("is-locked");
    if (menuBtn) {
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.focus();
    }
  }

  function openDropdown() {
    if (!dropdownMenu || !dropdownTrigger) return;
    if (dropdown) dropdown.classList.remove("is-dismissed");
    dropdownMenu.classList.add("is-open");
    dropdownTrigger.setAttribute("aria-expanded", "true");
  }

  function closeDropdown(dismiss) {
    if (!dropdownMenu || !dropdownTrigger) return;
    dropdownMenu.classList.remove("is-open");
    dropdownTrigger.setAttribute("aria-expanded", "false");
    if (dismiss && dropdown) {
      dropdown.classList.add("is-dismissed");
      if (document.activeElement === dropdownTrigger) dropdownTrigger.blur();
    }
  }

  function toggleDropdown() {
    if (!dropdownMenu || !dropdownTrigger) return;
    if (dropdownTrigger.getAttribute("aria-expanded") === "true") {
      closeDropdown(true);
    } else {
      openDropdown();
    }
  }

  if (menuBtn) menuBtn.addEventListener("click", openDrawer);
  if (closeBtn) closeBtn.addEventListener("click", closeDrawer);
  if (overlay) overlay.addEventListener("click", closeDrawer);

  if (dropdown) {
    var hoverTimer;

    dropdown.addEventListener("mouseenter", function () {
      clearTimeout(hoverTimer);
      openDropdown();
    });

    dropdown.addEventListener("mouseleave", function () {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(closeDropdown, 120);
    });
  }

  if (dropdownTrigger) {
    dropdownTrigger.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      toggleDropdown();
    });
  }

  document.addEventListener("click", function (e) {
    if (dropdown && !dropdown.contains(e.target)) {
      closeDropdown(true);
    }
  });

  if (accordionTrigger && accordionPanel) {
    accordionTrigger.addEventListener("click", function () {
      var open = accordionPanel.classList.toggle("is-open");
      accordionTrigger.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      closeDrawer();
      closeDropdown(true);
    }
  });

  window.addEventListener("scroll", function () {
    if (header) {
      header.classList.toggle("is-scrolled", window.scrollY > 40);
    }

    if (progressBar) {
      var doc = document.documentElement;
      var scrollTop = doc.scrollTop || body.scrollTop;
      var height = doc.scrollHeight - doc.clientHeight;
      var pct = height > 0 ? (scrollTop / height) * 100 : 0;
      progressBar.style.width = pct + "%";
    }
  });

  document.querySelectorAll("form[data-form]").forEach(function (form) {
    var status = form.querySelector("[data-form-status]");
    var submit = form.querySelector("[type='submit']");
    var successMsg =
      form.getAttribute("data-success") ||
      "Thank you! Your request has been sent to the LiteWeb team.";
    var errorMsg =
      form.getAttribute("data-error") ||
      "We could not send your message. Please try again.";
    var errorEmailMsg =
      form.getAttribute("data-error-email") ||
      "We could not send your message. Please email us directly.";
    var errorCaptchaMsg =
      form.getAttribute("data-error-captcha") ||
      "We could not verify this request. Please try again.";

    function setStatus(kind, message) {
      if (!status) return;
      status.classList.remove("is-success", "is-error");
      if (!kind) {
        status.hidden = true;
        status.textContent = "";
        return;
      }
      status.hidden = false;
      status.classList.add(kind === "success" ? "is-success" : "is-error");
      status.textContent = message;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      setStatus();
      if (submit) submit.disabled = true;

      var payload = {};
      var data = new FormData(form);
      data.forEach(function (value, key) {
        payload[key] = String(value);
      });

      var action = payload.form === "project" ? "project" : "contact";
      var endpoint = form.getAttribute("action") || "/api/contact";

      executeRecaptcha(action)
        .then(function (token) {
          if (recaptchaSiteKey() && !token) {
            throw new Error(errorCaptchaMsg);
          }
          if (token) payload["g-recaptcha-response"] = token;
          return fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(payload),
          });
        })
        .then(function (res) {
          return res.json().then(function (body) {
            var err = body && body.error;
            if (err && typeof err === "object") {
              err = err.message || err.code || errorMsg;
            }
            return { ok: res.ok && body && body.ok, error: err };
          });
        })
        .then(function (result) {
          if (!result.ok) {
            throw new Error(result.error || errorMsg);
          }
          form.reset();
          setStatus("success", successMsg);
        })
        .catch(function (err) {
          setStatus("error", err.message || errorEmailMsg);
        })
        .then(function () {
          if (submit) submit.disabled = false;
        });
    });
  });

  function recaptchaSiteKey() {
    return (window.SITE_CONFIG && window.SITE_CONFIG.recaptchaSiteKey) || "";
  }

  function loadRecaptcha(siteKey) {
    if (!siteKey) return Promise.resolve();
    if (window.grecaptcha && typeof window.grecaptcha.execute === "function") {
      return Promise.resolve();
    }
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector("script[data-recaptcha-api]");
      if (existing) {
        var tries = 0;
        var timer = window.setInterval(function () {
          tries += 1;
          if (window.grecaptcha && typeof window.grecaptcha.execute === "function") {
            window.clearInterval(timer);
            resolve();
          } else if (tries > 80) {
            window.clearInterval(timer);
            reject(new Error("recaptcha"));
          }
        }, 50);
        return;
      }
      var script = document.createElement("script");
      script.src =
        "https://www.google.com/recaptcha/api.js?render=" + encodeURIComponent(siteKey);
      script.async = true;
      script.defer = true;
      script.setAttribute("data-recaptcha-api", "true");
      script.onload = function () {
        resolve();
      };
      script.onerror = function () {
        reject(new Error("recaptcha"));
      };
      document.head.appendChild(script);
    });
  }

  function executeRecaptcha(action) {
    var siteKey = recaptchaSiteKey();
    if (!siteKey) return Promise.resolve("");
    return loadRecaptcha(siteKey).then(function () {
      return new Promise(function (resolve, reject) {
        window.grecaptcha.ready(function () {
          window.grecaptcha
            .execute(siteKey, { action: action || "submit" })
            .then(resolve, reject);
        });
      });
    });
  }

  function initRecaptcha() {
    if (!document.querySelector("form[data-form]")) return;
    var fromConfig = recaptchaSiteKey();
    if (fromConfig) {
      loadRecaptcha(fromConfig).catch(function () {});
      return;
    }
    fetch("/api/config", { headers: { Accept: "application/json" } })
      .then(function (res) {
        return res.ok ? res.json() : {};
      })
      .then(function (cfg) {
        var key = cfg && cfg.recaptchaSiteKey;
        if (!key) return;
        if (!window.SITE_CONFIG) window.SITE_CONFIG = {};
        window.SITE_CONFIG.recaptchaSiteKey = key;
        return loadRecaptcha(key);
      })
      .catch(function () {});
  }

  initRecaptcha();

  function digitsOnly(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function formatPhone(value) {
    var digits = digitsOnly(value);
    if (digits.indexOf("961") === 0 && digits.length >= 11) {
      return "+961 " + digits.slice(3, 5) + " " + digits.slice(5, 8) + " " + digits.slice(8);
    }
    return value || "";
  }

  function applySiteConfig() {
    var cfg = window.SITE_CONFIG || {};
    var phone = cfg.phone || "+96176653348";
    var email = cfg.email || "hello@liteweb.info";
    var phoneDigits = digitsOnly(phone);
    var display = formatPhone(phone);

    document.querySelectorAll("[data-config='phone']").forEach(function (el) {
      el.textContent = display;
      if (el.tagName === "A") {
        el.setAttribute("href", "tel:+" + phoneDigits);
      }
    });

    document.querySelectorAll("[data-config='email']").forEach(function (el) {
      el.textContent = email;
      if (el.tagName === "A") {
        el.setAttribute("href", "mailto:" + email);
      }
    });

    var wa = document.querySelector("[data-whatsapp]");
    if (wa) {
      wa.setAttribute("href", "https://wa.me/" + digitsOnly(cfg.whatsapp || phone));
    }

    ["facebook", "x", "instagram"].forEach(function (key) {
      document.querySelectorAll("[data-config='" + key + "']").forEach(function (el) {
        var url = cfg[key];
        if (url) {
          el.setAttribute("href", url);
          el.removeAttribute("hidden");
        } else {
          el.setAttribute("hidden", "");
        }
      });
    });

    document.querySelectorAll(".site-footer__social").forEach(function (nav) {
      var visible = nav.querySelectorAll("a:not([hidden])");
      nav.hidden = visible.length === 0;
    });
  }

  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });

  applySiteConfig();

  var REVEAL_SELECTOR = [
    ".hero__grid > *",
    ".about-hero__grid > *",
    ".product-hero > *",
    ".feature-row > *",
    ".stat",
    ".card",
    ".feature-card",
    ".product-tile",
    ".price-card",
    ".method-step",
    ".process-step",
    ".case-study",
    ".portfolio-card",
    ".faq details",
    ".tech-pills__item",
    ".cta-banner",
    ".home-cta .container > *",
    ".product-detail-cta .container > *",
    ".about-cta .container > *",
    ".container > .max-w-2xl",
    ".container > .max-w-3xl",
    ".container > .max-w-xl",
    ".container > .mb-xl",
    ".container > .text-center",
    ".service-bento__item",
    ".team-card",
  ].join(",");

  var COUNT_DURATION = 1400;
  var STAGGER_MS = 80;
  var STAGGER_CAP = 400;

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  function parseStat(text) {
    var m = String(text).trim().match(/^(\d+(?:\.\d+)?)(.*)$/);
    if (!m) return null;
    var suffix = m[2];
    if (suffix.indexOf("/") !== -1) return null;
    if (/bit/i.test(suffix)) return null;
    var value = parseFloat(m[1]);
    if (!isFinite(value)) return null;
    var decimals = (m[1].split(".")[1] || "").length;
    return { value: value, suffix: suffix, decimals: decimals, original: String(text).trim() };
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function countUp(el, parsed) {
    var start = null;

    function frame(now) {
      if (start === null) start = now;
      var t = Math.min((now - start) / COUNT_DURATION, 1);
      var current = parsed.value * easeOutCubic(t);
      if (parsed.decimals > 0) {
        el.textContent = current.toFixed(parsed.decimals) + parsed.suffix;
      } else {
        el.textContent = String(Math.round(current)) + parsed.suffix;
      }
      if (t < 1) {
        window.requestAnimationFrame(frame);
      } else {
        el.textContent = parsed.original;
      }
    }

    window.requestAnimationFrame(frame);
  }

  function startStatCount(statEl) {
    var valueEl = statEl.querySelector(".stat__value");
    if (!valueEl) return;
    var parsed = parseStat(valueEl.textContent);
    if (!parsed) return;
    if (parsed.decimals > 0) {
      valueEl.textContent = (0).toFixed(parsed.decimals) + parsed.suffix;
    } else {
      valueEl.textContent = "0" + parsed.suffix;
    }
    countUp(valueEl, parsed);
  }

  function markRevealed(el) {
    el.classList.add("is-revealed");
  }

  function revealEl(el) {
    if (el.classList.contains("is-visible")) return;

    if (el.classList.contains("stat") && !prefersReducedMotion()) {
      startStatCount(el);
    }

    el.classList.add("is-visible");

    function onEnd(e) {
      if (e && e.target !== el) return;
      if (e && e.propertyName && e.propertyName !== "opacity" && e.propertyName !== "transform") {
        return;
      }
      el.removeEventListener("transitionend", onEnd);
      markRevealed(el);
    }

    el.addEventListener("transitionend", onEnd);
    window.setTimeout(function () {
      markRevealed(el);
    }, 1200);
  }

  function initReveal() {
    var main = document.querySelector(".page-main");
    if (!main) return;

    var nodeList = main.querySelectorAll(REVEAL_SELECTOR);
    if (!nodeList.length) return;

    var targets = Array.prototype.slice.call(nodeList);

    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      targets.forEach(function (el) {
        el.classList.add("is-visible");
        markRevealed(el);
      });
      return;
    }

    targets.forEach(function (el) {
      var parent = el.parentElement;
      var index = parent ? Array.prototype.indexOf.call(parent.children, el) : 0;
      if (index < 0) index = 0;
      el.style.setProperty("--reveal-delay", Math.min(index * STAGGER_MS, STAGGER_CAP) + "ms");
    });

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          revealEl(entry.target);
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    targets.forEach(function (el) {
      observer.observe(el);
    });
  }

  initReveal();

  function initPortfolioFilters() {
    var filterBar = document.querySelector("[data-portfolio-filters]");
    var grid = document.querySelector("[data-portfolio-grid]");
    if (!filterBar || !grid) return;

    var chips = filterBar.querySelectorAll("[data-category]");
    var cards = grid.querySelectorAll("[data-category]");
    var empty = document.querySelector("[data-portfolio-empty]");

    function applyFilter(category) {
      var shown = 0;
      cards.forEach(function (card) {
        var match = !category || card.getAttribute("data-category") === category;
        card.classList.toggle("is-hidden", !match);
        if (match) shown += 1;
      });

      chips.forEach(function (chip) {
        chip.classList.toggle("is-active", chip.getAttribute("data-category") === category);
      });

      if (empty) {
        if (shown === 0) empty.removeAttribute("hidden");
        else empty.setAttribute("hidden", "");
      }

      var url = new URL(window.location.href);
      if (category) url.searchParams.set("category", category);
      else url.searchParams.delete("category");
      window.history.replaceState({}, "", url.pathname + url.search + url.hash);
    }

    var params = new URLSearchParams(window.location.search);
    var initial = params.get("category") || "";
    var valid = initial === "" || Array.prototype.some.call(chips, function (chip) {
      return chip.getAttribute("data-category") === initial;
    });
    applyFilter(valid ? initial : "");

    filterBar.addEventListener("click", function (e) {
      var chip = e.target.closest("[data-category]");
      if (!chip || !filterBar.contains(chip)) return;
      applyFilter(chip.getAttribute("data-category") || "");
    });
  }

  initPortfolioFilters();
})();
