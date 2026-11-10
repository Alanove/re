(function () {
	'use strict';

	var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

	/* Images that fail to load swap to their data-fallback-src once (thumbnail missing, YouTube maxres missing). */
	function useFallback(img) {
		var fallback = img.getAttribute('data-fallback-src');
		if (fallback && img.getAttribute('src') !== fallback) {
			img.setAttribute('src', fallback);
		}
	}

	function isYoutubePlaceholder(img) {
		return img.complete && img.naturalWidth > 0 && img.naturalWidth <= 120 && /ytimg\.com/.test(img.currentSrc || img.src);
	}

	function watchImage(img) {
		img.addEventListener('error', function () {
			useFallback(img);
		});
		img.addEventListener('load', function () {
			if (isYoutubePlaceholder(img)) {
				useFallback(img);
			}
		});
		if (img.complete && (img.naturalWidth === 0 || isYoutubePlaceholder(img))) {
			useFallback(img);
		}
	}

	function initFallbacks() {
		document.querySelectorAll('img[data-fallback-src]').forEach(watchImage);
	}

	/* Header: transparent over the hero, solid once the page scrolls. */
	function initHeader() {
		var header = document.querySelector('[data-header]');
		if (!header) {
			return;
		}
		var update = function () {
			header.classList.toggle('is-scrolled', window.scrollY > 40);
		};
		update();
		window.addEventListener('scroll', update, { passive: true });
	}

	/* Full-screen menu on small screens. */
	function initMenu() {
		var toggle = document.querySelector('[data-nav-toggle]');
		var overlay = document.querySelector('[data-menu-overlay]');
		if (!toggle || !overlay) {
			return;
		}
		var setOpen = function (open) {
			toggle.setAttribute('aria-expanded', String(open));
			overlay.hidden = !open;
			document.body.classList.toggle('menu-open', open);
			if (open) {
				var first = overlay.querySelector('a');
				if (first) {
					first.focus();
				}
			}
		};
		toggle.addEventListener('click', function () {
			setOpen(toggle.getAttribute('aria-expanded') !== 'true');
		});
		overlay.addEventListener('click', function (event) {
			if (event.target.closest('a')) {
				setOpen(false);
			}
		});
		document.addEventListener('keydown', function (event) {
			if (event.key === 'Escape' && !overlay.hidden) {
				setOpen(false);
				toggle.focus();
			}
		});
		window.matchMedia('(min-width: 900px)').addEventListener('change', function (query) {
			if (query.matches) {
				setOpen(false);
			}
		});
	}

	/* Video player: the YouTube iframe only loads after a click; cards switch the video on the stage. */
	function initVideos() {
		document.querySelectorAll('[data-video-player]').forEach(function (player) {
			var stage = player.querySelector('[data-video-stage]');
			if (!stage) {
				return;
			}
			var frame = stage.querySelector('[data-video-frame]');
			var poster = stage.querySelector('[data-video-poster]');
			var playButton = stage.querySelector('[data-video-play]');
			var title = stage.querySelector('[data-video-title]');
			var date = stage.querySelector('[data-video-date]');
			var link = stage.querySelector('[data-video-link]');

			var play = function () {
				var src = frame.getAttribute('data-embed');
				if (!src) {
					return;
				}
				var existing = frame.querySelector('iframe');
				if (existing) {
					existing.remove();
				}
				var iframe = document.createElement('iframe');
				iframe.src = src;
				iframe.title = frame.getAttribute('data-title') || 'YouTube video';
				iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
				iframe.allowFullscreen = true;
				iframe.referrerPolicy = 'strict-origin-when-cross-origin';
				frame.appendChild(iframe);
				frame.classList.add('is-playing');
				iframe.focus();
			};

			var stop = function () {
				var existing = frame.querySelector('iframe');
				if (existing) {
					existing.remove();
				}
				frame.classList.remove('is-playing');
			};

			if (playButton) {
				playButton.addEventListener('click', play);
			}

			player.querySelectorAll('[data-video-select]').forEach(function (card) {
				card.addEventListener('click', function (event) {
					if (event.metaKey || event.ctrlKey || event.shiftKey || event.button === 1) {
						return;
					}
					event.preventDefault();
					stop();
					var videoTitle = card.getAttribute('data-title') || '';
					frame.setAttribute('data-embed', card.getAttribute('data-embed') || '');
					frame.setAttribute('data-title', videoTitle);
					poster.setAttribute('data-fallback-src', card.getAttribute('data-poster-fallback') || '');
					poster.setAttribute('src', card.getAttribute('data-poster') || '');
					if (title) {
						title.textContent = videoTitle;
					}
					if (date) {
						date.textContent = card.getAttribute('data-date') || '';
					}
					if (link) {
						link.setAttribute('href', card.getAttribute('data-watch') || '#');
					}
					if (playButton) {
						playButton.setAttribute('aria-label', 'Play “' + videoTitle + '”');
					}
					player.querySelectorAll('.video-card.is-current').forEach(function (item) {
						item.classList.remove('is-current');
					});
					card.closest('.video-card').classList.add('is-current');
					var top = stage.getBoundingClientRect().top;
					if (top < 0 || top > window.innerHeight * 0.6) {
						stage.scrollIntoView({ behavior: reducedMotion.matches ? 'auto' : 'smooth', block: 'start' });
					}
					play();
				});
			});
		});
	}

	/* Quotes: one at a time with dots and arrows; rotates slowly unless the visitor prefers reduced motion. */
	function initQuotes() {
		document.querySelectorAll('[data-quotes]').forEach(function (root) {
			var quotes = Array.prototype.slice.call(root.querySelectorAll('[data-quote]'));
			var nav = root.querySelector('[data-quotes-nav]');
			if (quotes.length < 2 || !nav) {
				return;
			}
			var dots = Array.prototype.slice.call(root.querySelectorAll('[data-quotes-dot]'));
			var current = 0;
			var timer = null;

			var show = function (index) {
				current = (index + quotes.length) % quotes.length;
				quotes.forEach(function (quote, i) {
					quote.classList.toggle('is-hidden', i !== current);
					quote.setAttribute('aria-hidden', String(i !== current));
				});
				dots.forEach(function (dot, i) {
					if (i === current) {
						dot.setAttribute('aria-current', 'true');
					} else {
						dot.removeAttribute('aria-current');
					}
				});
			};
			var stopTimer = function () {
				if (timer) {
					window.clearInterval(timer);
					timer = null;
				}
			};
			var startTimer = function () {
				stopTimer();
				if (!reducedMotion.matches) {
					timer = window.setInterval(function () {
						show(current + 1);
					}, 8000);
				}
			};

			root.classList.add('is-carousel');
			nav.hidden = false;
			show(0);
			startTimer();

			root.querySelector('[data-quotes-prev]').addEventListener('click', function () {
				show(current - 1);
				startTimer();
			});
			root.querySelector('[data-quotes-next]').addEventListener('click', function () {
				show(current + 1);
				startTimer();
			});
			dots.forEach(function (dot) {
				dot.addEventListener('click', function () {
					show(Number(dot.getAttribute('data-quotes-dot')));
					startTimer();
				});
			});
			root.addEventListener('mouseenter', stopTimer);
			root.addEventListener('mouseleave', startTimer);
			root.addEventListener('focusin', stopTimer);
			root.addEventListener('focusout', startTimer);
		});
	}

	/* Gallery lightbox built on <dialog>. */
	function initLightbox() {
		var dialog = document.querySelector('[data-lightbox]');
		if (!dialog || typeof dialog.showModal !== 'function') {
			return;
		}
		var image = dialog.querySelector('[data-lightbox-image]');
		var caption = dialog.querySelector('[data-lightbox-caption]');
		var count = dialog.querySelector('[data-lightbox-count]');
		var prev = dialog.querySelector('[data-lightbox-prev]');
		var next = dialog.querySelector('[data-lightbox-next]');
		var items = [];
		var index = 0;

		var render = function () {
			var item = items[index];
			image.setAttribute('src', item.getAttribute('href'));
			image.setAttribute('alt', item.querySelector('img') ? item.querySelector('img').getAttribute('alt') || '' : '');
			caption.textContent = item.getAttribute('data-caption') || '';
			count.textContent = items.length > 1 ? index + 1 + ' / ' + items.length : '';
			prev.hidden = items.length < 2;
			next.hidden = items.length < 2;
		};
		var step = function (delta) {
			index = (index + delta + items.length) % items.length;
			render();
		};

		document.querySelectorAll('[data-lightbox-group]').forEach(function (group) {
			var groupItems = Array.prototype.slice.call(group.querySelectorAll('[data-lightbox-item]'));
			groupItems.forEach(function (item, i) {
				item.addEventListener('click', function (event) {
					event.preventDefault();
					items = groupItems;
					index = i;
					render();
					dialog.showModal();
				});
			});
		});

		dialog.querySelector('[data-lightbox-close]').addEventListener('click', function () {
			dialog.close();
		});
		prev.addEventListener('click', function () {
			step(-1);
		});
		next.addEventListener('click', function () {
			step(1);
		});
		dialog.addEventListener('click', function (event) {
			if (event.target === dialog) {
				dialog.close();
			}
		});
		dialog.addEventListener('keydown', function (event) {
			if (items.length < 2) {
				return;
			}
			var rtl = document.documentElement.dir === 'rtl';
			if (event.key === 'ArrowRight') {
				step(rtl ? -1 : 1);
			} else if (event.key === 'ArrowLeft') {
				step(rtl ? 1 : -1);
			}
		});
		dialog.addEventListener('close', function () {
			image.removeAttribute('src');
		});
	}

	function playMuted(video) {
		video.muted = true;
		var attempt = video.play();
		return attempt && typeof attempt.then === 'function' ? attempt : Promise.resolve();
	}

	/*
	 * Home hero: photos crossfade on a timer and video slides play muted to their end.
	 * The rotation holds while the hero is off screen or the tab is hidden, and starts paused
	 * for visitors who prefer reduced motion; the pause button and dots stay available to everyone.
	 */
	function initHero() {
		var hero = document.querySelector('.hero');
		if (!hero) {
			return;
		}
		var slides = Array.prototype.slice.call(hero.querySelectorAll('[data-hero-slide]'));
		if (slides.length === 0) {
			return;
		}
		if (!hero.hasAttribute('data-hero-slider')) {
			var single = slides[0].querySelector('[data-hero-video]');
			if (single && !reducedMotion.matches) {
				playMuted(single).catch(function () {
					single.removeAttribute('preload');
				});
			}
			return;
		}

		var controls = hero.querySelector('[data-hero-controls]');
		var toggle = hero.querySelector('[data-hero-toggle]');
		var caption = hero.querySelector('[data-hero-caption]');
		var dots = Array.prototype.slice.call(hero.querySelectorAll('[data-hero-dot]'));
		var interval = (Number(hero.getAttribute('data-interval')) || 7) * 1000;
		var longestVideo = 120000;
		var current = 0;
		var timer = null;
		var paused = reducedMotion.matches;
		var offscreen = false;

		hero.style.setProperty('--hero-interval', interval / 1000 + 's');

		var videoOf = function (slide) {
			return slide.querySelector('[data-hero-video]');
		};
		var clearTimer = function () {
			if (timer) {
				window.clearTimeout(timer);
				timer = null;
			}
		};
		var next = function () {
			show(current + 1);
		};
		var held = function () {
			return paused || offscreen;
		};

		var schedule = function () {
			clearTimer();
			hero.classList.remove('is-video');
			hero.classList.toggle('is-held', offscreen);
			var video = videoOf(slides[current]);
			if (held()) {
				if (video) {
					video.pause();
				}
				return;
			}
			var upcoming = videoOf(slides[(current + 1) % slides.length]);
			if (upcoming) {
				upcoming.preload = 'auto';
			}
			if (!video) {
				timer = window.setTimeout(next, interval);
				return;
			}
			hero.classList.add('is-video');
			timer = window.setTimeout(next, longestVideo);
			playMuted(video).catch(function () {
				hero.classList.remove('is-video');
				clearTimer();
				if (!held()) {
					timer = window.setTimeout(next, interval);
				}
			});
		};

		function show(index) {
			var previous = slides[current];
			current = (index + slides.length) % slides.length;
			var incoming = slides[current];
			slides.forEach(function (slide) {
				if (slide !== incoming) {
					slide.classList.remove('is-leaving');
				}
			});
			if (previous !== incoming) {
				previous.classList.remove('is-active');
				previous.classList.add('is-leaving');
				previous.setAttribute('aria-hidden', 'true');
				var previousVideo = videoOf(previous);
				if (previousVideo) {
					previousVideo.pause();
				}
				incoming.classList.remove('is-leaving');
				void incoming.offsetWidth;
				incoming.classList.add('is-active');
				incoming.removeAttribute('aria-hidden');
				var incomingVideo = videoOf(incoming);
				if (incomingVideo) {
					incomingVideo.currentTime = 0;
				}
			}
			dots.forEach(function (dot, i) {
				if (i === current) {
					dot.setAttribute('aria-current', 'true');
				} else {
					dot.removeAttribute('aria-current');
				}
			});
			if (caption) {
				caption.textContent = incoming.getAttribute('data-caption') || '';
			}
			schedule();
		}

		var setPaused = function (value) {
			paused = value;
			hero.classList.toggle('is-paused', paused);
			toggle.setAttribute('aria-label', paused ? 'Play the slideshow' : 'Pause the slideshow');
			schedule();
		};

		slides.forEach(function (slide) {
			var video = videoOf(slide);
			if (video) {
				video.addEventListener('ended', function () {
					if (slide === slides[current] && !held()) {
						next();
					}
				});
			}
		});
		toggle.addEventListener('click', function () {
			setPaused(!paused);
		});
		dots.forEach(function (dot) {
			dot.addEventListener('click', function () {
				show(Number(dot.getAttribute('data-hero-dot')));
			});
		});
		document.addEventListener('visibilitychange', function () {
			offscreen = document.hidden;
			schedule();
		});
		if ('IntersectionObserver' in window) {
			new IntersectionObserver(
				function (entries) {
					offscreen = document.hidden || !entries[0].isIntersecting;
					schedule();
				},
				{ threshold: 0.15 }
			).observe(hero);
		}

		controls.hidden = false;
		hero.classList.toggle('is-paused', paused);
		toggle.setAttribute('aria-label', paused ? 'Play the slideshow' : 'Pause the slideshow');
		show(0);
	}

	/* Background hero videos pause for visitors who prefer reduced motion. */
	function initMotionVideos() {
		if (!reducedMotion.matches) {
			return;
		}
		document.querySelectorAll('[data-motion-video]').forEach(function (video) {
			video.removeAttribute('autoplay');
			video.pause();
		});
	}

	function init() {
		initFallbacks();
		initHeader();
		initHero();
		initMenu();
		initVideos();
		initQuotes();
		initLightbox();
		initMotionVideos();
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init);
	} else {
		init();
	}
})();
