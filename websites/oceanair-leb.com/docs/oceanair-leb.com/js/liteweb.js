/// <reference path="../../../doc/jquery-1.9.1-vsdoc" />
/// <reference path="../../utils/1.0.2.2/Utils.js" />

//Copyright 2013
//Version: 1.0.2.3
//Create: May 30 2012
//Modify: December 10 2014

String.prototype.TrimLeft = function () {
	return this.replace(/^(\s|\xA0|&nbsp;)*/, "");
};
String.prototype.TrimRight = function () {
	return this.replace(/(\s|\xA0|&nbsp;)*$/, "");
};
String.prototype.trim = String.prototype.Trim = function () {
	return this.TrimLeft().TrimRight();
};
String.prototype.toLower = function () {
	return this.toLowerCase();
};
String.prototype.Format = function () {
	var obj = arguments[0];
	var s = this;

	if (typeof obj == "object")
		for (i in obj) {
			var reg = new RegExp("\\\{" + i + "\\\}", "g");
			s = s.replace(reg, obj[i]);
		}
	else
		for (var i = 0; i < arguments.length; i++) {
			var reg = new RegExp("\\\{" + i + "\\\}", "g");
			s = s.replace(reg, arguments[i]);
		}
	return s;
}

function Dimension(el) {
	this.width = el.offsetWidth;
	this.height = el.offsetHeight;
}
function GetPosition(el) {
	var l = el.offsetLeft, t = el.offsetTop;
	while ((el = el.offsetParent) != null) {
		l += el.offsetLeft;
		t += el.offsetTop;
	}
	var obj = {
		"top": t, "left": l
	};
	return obj;
};
function GetMousePosition(f) {
	var top = event.y + window.document.body.scrollTop;
	var left = event.x + window.document.body.scrollLeft;
	if (f) {
		var pos = GetPosition(f.frameElement);
		top += pos.top;
		left += pos.left;
	}
	var obj = {
		"top": top, "left": left
	};
	return obj;
}
/*
///Checks if the object inherits another object
Object.prototype.Is = function (object) {
	for (i in object) {
		if (!this[i])
			return false;
		if (typeof this[i] != typeof object[i])
			return false;
	}
	return true
}
*/
function Dimension(el) {
	this.width = el.offsetWidth;
	this.height = el.offsetHeight;
}
function Trank(str, len) {
	return str.length > len ? str.substring(0, len) + (len > 3 ? "..." : "") : str;
}
function InitFormValue(f, v) {
	switch (f.type) {
		case "file":
			break;
		case "select-one":
			for (var j = 0; j < f.options.length; j++) {
				if (f.options[j].value == v) {
					f.options[j].selected = true;
					break;
				}
			}
			break;
		case "checkbox":
			f.checked = v;
			break;
		case "radio":
			f.checked = v;
			break;
		default:
			f.value = value;
			break;
	}
}
function defined(a) {
	var ret = (typeof (a) == "undefined");
	if (ret == true)
		return false;
	if (typeof (a) == "string" && a == "")
		return false;
	return (a != null);
}
function isOk(a) {
	return defined(a);
}
function GetViewWidth(full) {
	if (!jQuery)
		return null;
	return full ? Math.max(jQuery(document).width(), jQuery(window).width()) : jQuery(window).width();
}

function GetViewHeight(full) {
	if (!jQuery)
		return null;
	return full ? Math.max(jQuery(document).height(), jQuery(window).height()) : jQuery(window).height();
}
function addStyle(name, rules) {
	var node = document.createElement("style");
	node.setAttribute("type", "text/css");
	var text = "{0}{{1}}".Format(name, rules);
	var isIE = /msie/i.test(navigator.userAgent);
	if (!isIE)
		node.appendChild(document.createTextNode(text));
	document.getElementsByTagName("head")[0].appendChild(node);
	if (isIE && document.styleSheets && document.styleSheets.length > 0) {
		var lastStyle = document.styleSheets[document.styleSheets.length - 1];
		if (typeof (lastStyle.addRule) == "object")
			lastStyle.addRule(name, rules);
	}
}

function _trace(obj) {
	window.lw = window.lw ? window.lw : {};
	var lw = window.lw;
	if (!lw.debContainer) {
		lw.debContainer = $("<div style=\"z-index:999999999;padding:5px;box-shadow: -5px 5px 10px #888;background-color:#efefef;border:3px double black;border-radius:5px;width:200px;height:300px;overflow:auto;position:fixed;right:0;top:0\"></div>");
		$(document.body).append(lw.debContainer);
	}
	var el = $("<div />");
	if ((typeof obj == typeof ("")) || (typeof obj == typeof (1)))
		el.html(obj);
	/*
	else {
		for (i in obj) {
			deb("<b>" + i + "</b>");
			deb(obj[i]);
		}
	}
	*/
	lw.debContainer.prepend(el);
}

function inArray(array, obj) {
	return (array.indexOf(obj) != -1);
}

function compare(obj1, obj2, datatype) {
	var greaterThan = ">";
	var lessThan = "<";
	var equal = "=";

	obj1 = obj1 ? obj1 : "";
	obj2 = obj2 ? obj2 : "";


	switch (datatype.toLowerCase()) {
		case "number":
		case "integer":
		case "decimal":
		case "float":
		case "int":
			var val1 = parseFloat(obj1.toString());
			var val2 = parseFloat(obj2.toString());
			if (val1 > val2)
				return greaterThan;
			if (val1 < val2)
				return lessThan;
			return equal;
			break;
		case "date":
			var val1 = Date.parse(obj1.toString());
			var val2 = Date.parse(obj2.toString());
			if (val1 > val2)
				return greaterThan;
			if (val1 < val2)
				return lessThan;
			return equal;
			break;
		case "string":
			var val1 = obj1.toString();
			var val2 = obj2.toString();
			if (val1 > val2)
				return greaterThan;
			if (val1 < val2)
				return lessThan;
			return equal;
			break;
		default:
			var val1 = obj1.toString().length;
			var val2 = obj2.toString().length;
			if (val1 > val2)
				return greaterThan;
			if (val1 < val2)
				return lessThan;
			return equal;
			break;
	}
}


var lwUtils = {
	version: "1.0.2.2",
	createDate: "May 30 2012",
	modifiedDate: "January 16 2013",
	_an: 0,
	an: function () {
		return ++lw.utils._an;
	},
	dimension: Dimension,
	isOk: isOk,
	trace: _trace,
	compare: compare,
	inArray: inArray,
	initFormValue: InitFormValue,
	trankate: Trank,
	viewWith: GetViewWidth,
	viewHeight: GetViewHeight,
	passwordScorrer: function (password) {
		var score = 0;

		var len = password.length;

		if (len >= 21) { score = 7; }
		else if (len >= 16) { score = 6; }
		else if (len >= 13) { score = 5; }
		else if (len >= 10) { score = 4; }
		else if (len >= 8) { score = 3; }
		else if (len >= 5) { score = 2; }

		//lower case char
		if (passwd.match(/[a-z]/)) score += 1;

		//upper case char
		if (passwd.match(/[A-Z]/)) score += 5;

		// NUMBERS
		if (passwd.match(/\d+/)) score += 5;
		if (passwd.match(/(.*[0-9].*[0-9].*[0-9])/)) score += 5;


		// SPECIAL CHAR
		if (passwd.match(/.[!,@,#,$,%,^,&,*,?,_,~]/)) score += 5;

		if (passwd.match(/(.*[!,@,#,$,%,^,&,*,?,_,~].*[!,@,#,$,%,^,&,*,?,_,~])/)) score += 5;

		// COMBOS
		//lower and upper case
		if (passwd.match(/([a-z].*[A-Z])|([A-Z].*[a-z])/)) score += 2;

		// letters, numbers
		if (passwd.match(/([a-zA-Z])/) && passwd.match(/([0-9])/)) score += 2;

		// letters, numbers, and special characters
		if (passwd.match(/([a-zA-Z0-9].*[!,@,#,$,%,^,&,*,?,_,~])|([!,@,#,$,%,^,&,*,?,_,~].*[a-zA-Z0-9])/)) score += 2;

		//below 16 weak, above 45 strong a meter can be created from 16(0%) to 45(95%)
		return score;
	},
	equals: function (a, b, ignoreCase) {
		if (ignoreCase) {
			return a.toLowerCase() === b.toLowerCase();
		}
		return a === b;
	},
	fieldMask: function (field, val) {
		if (!isOk(field))
			return;
		field.bind("focus", function () {
			if (field.val() == val) {
				field.val("");
				field.removeClass("empty");
			}
		});
		field.bind("blur", function () {
			if (field.val() == "") {
				field.val(val);
				field.addClass("empty");
			}
		});
	},
	stripOutHtmlTags: function (s) {
		if (s == null)
			return "";

		var r = new RegExp("<[^>]+>");
		return s.replace(r, "");
	},
	trankate: function (s, l, end) {
		end = "..." || end;
		s = lw.utils.stripOutHtmlTags(s);
		if (s.length > l) {
			s = s.substring(0, l - 3);
			var r = new RegExp("\\s([a-z_0-9.&;])*$", "i");
			return lw.utils.sup(s.replace(r, end));
		}
		return s;
	},
	sup: function (s) {
		return s.replace(/<sup>&amp;reg;<\/sup>/ig, "®")
			.replace(/<sup>®<\/sup>/ig, "®")
			.replace(/\&amp;reg;/ig, "&reg;")
			.replace(/\&reg;/ig, "<sup>&reg;</sup>")
			.replace(/®/ig, "<sup>&reg;</sup>");
	},
	relative_time: function (parsed_date) {

		parsed_date = typeof parsed_date === "string" ? Date.parse(parsed_date) : parsed_date;

		var relative_to = (arguments.length > 1) ? arguments[1] : new Date();
		var delta = parseInt((relative_to.getTime() - parsed_date) / 1000);
		//delta = delta + (relative_to.getTimezoneOffset() * 60);

		if (delta < 60) {
			return 'less than a minute ago';
		} else if (delta < 120) {
			return 'about a minute ago';
		} else if (delta < (60 * 60)) {
			return (parseInt(delta / 60)).toString() + ' minutes ago';
		} else if (delta < (120 * 60)) {
			return 'about an hour ago';
		} else if (delta < (24 * 60 * 60)) {
			return 'about ' + (parseInt(delta / 3600)).toString() + ' hours ago';
		} else if (delta < (48 * 60 * 60)) {
			return '1 day ago';
		} else {
			return (parseInt(delta / 86400)).toString() + ' days ago';
		}
	},
	capitaliseFirstLetter: function (string) {
		return string.charAt(0).toUpperCase() + string.slice(1);
	},
	toId: function (str, replacement) {
		if (!isOk(replacement))
			replacement = "-";
		str = str.toLowerCase();

		str = str.replace("&reg;", "");

		var r = /\W/ig;
		var r1 = /\s+/g;

		var before = "àÀâÂäÄáÁéÉèÈêÊëËìÌîÎïÏòÒôÔöÖùÙûÛüÜçÇ’ñ/ó:";
		var after = "aAaAaAaAeEeEeEeEiIiIiIoOoOoOuUuUuUcC-n-o ";

		var cleaned = str;

		for (i = 0; i < before.length; i++) {
			cleaned = cleaned.replace(before.charAt(i), after.charAt(i));
		}

		cleaned = cleaned.replace(r, " ");
		cleaned = cleaned.replace(r1, " ");

		cleaned = cleaned.trim().replace(/ /g, replacement);

		return cleaned;
	},
	request: function (key) {
		var _ = lw.utils;
		if (!_.query) {
			_.query = {};
			var temp = location.href.split("?");

			if (temp.length == 0)
				return null;

			var hash = temp[1];

			var arr = hash.split("&");
			_.query = {};
			for (var i = 0; i < arr.length; i++) {
				if (arr[i].Trim() != "") {
					var temp = arr[i].Trim().split("=");
					if (temp.length == 2) {
						_.query[temp[0].Trim()] = temp[1].Trim();
					}
				}
			}
		}

		return _.query[key];
	},
	getTopZIndex: function (container) {
		var _ = lw.utils;
		//if (_.maxIndex)
		//	return _.maxIndex;

		container = "body" || container;
		var maxZ = 1;
		$(container + ' *').each(function (e, n) {
			var $this = $(this);
			if ($this.css('position') != 'static' && $this.css('z-index') != "auto") {
				maxZ = Math.max(maxZ, parseInt($this.css('z-index')));
			}
		});
		_.maxIndex = maxZ + 100;
		return _.maxIndex;
	},
	getFromJsonArray: function (jSonArray, objectToTest) {
		//Use TAFFYDB

		var ret = null;

		for (var i = 0; i < jSonArray.length; i++) {

			var testOk = true;

			for (prop in objectToTest) {
				if (typeof prop == "string") {
					if (jSonArray[i][prop] !== objectToTest[prop]) {
						testOk = false;
						break;
					}
				}
			}
			if (testOk) {
				ret = jSonArray[i];
				break;
			}
		}

		return ret;
	},
	toURL: function (str, replacement) {
		if (!isOk(replacement))
			replacement = "-";
		str = str.toLowerCase();
		var htmlRemover = new RegExp("<[^>]+>", "ig");
		str = str.replace(htmlRemover, "");

		str = str.replace(/\&reg;/g, "");

		var r = new RegExp("\\W", "ig");
		var r1 = new RegExp("\\s+", "ig");

		var before = "àÀâÂäÄáÁéÉèÈêÊëËìÌîÎïÏòÒôÔöÖùÙûÛüÜçÇ’ñ/ó:";
		var after = "aAaAaAaAeEeEeEeEiIiIiIoOoOoOuUuUuUcC-n-o ";

		var cleaned = str;

		for (var i = 0; i < before.Length; i++) {
			cleaned = cleaned.replace(new RegExp(before[i], "ig"), after[i].ToString());
		}

		cleaned = cleaned.replace(r1, " ").replace(r, " ").trim();

		cleaned = cleaned.replace(/ /g, replacement);

		var r3 = new RegExp(replacement + "+", "ig");

		return cleaned.replace(r3, replacement);
	}
}

this.lw = this.lw ? this.lw : {};
this.lw.utils = lwUtils;




/* ==============================================
Disable Scrolling
=============================================== */

// left: 37, up: 38, right: 39, down: 40,
// spacebar: 32, pageup: 33, pagedown: 34, end: 35, home: 36
var keys = [37, 38, 39, 40];

function preventDefault(e) {
	e = e || window.event;
	if (e.preventDefault)
		e.preventDefault();
	e.returnValue = false;
}

function keydown(e) {
	for (var i = keys.length; i--;) {
		if (e.keyCode === keys[i]) {
			preventDefault(e);
			return;
		}
	}
}

function wheel(e) {
	preventDefault(e);
}

function disable_scroll() {
	if (window.addEventListener) {
		window.addEventListener('DOMMouseScroll', wheel, false);
	}
	window.onmousewheel = document.onmousewheel = wheel;
	document.onkeydown = keydown;
}

function enable_scroll() {
	if (window.removeEventListener) {
		window.removeEventListener('DOMMouseScroll', wheel, false);
	}
	window.onmousewheel = document.onmousewheel = document.onkeydown = null;
}

lw.utils.enableScroll = enable_scroll;
lw.utils.disableScroll = disable_scroll;



/**
* Version: 4.0.6.6
* Build Date: March-19-2014
* Copyright (c) 2006-2012
* License: Licensed under The MIT License.
*/
var lw = {
	version: "4.0.6.7",
	createDate: "May 04 2012",
	modifiedDate: "June-13-2015",
	currentSkin: "skins/default/",
	popupCte: {
		perspective: "200px",
		rotate: "3",
		speed: 500,
		easing: "snap",
		position: "c", //tl, tr, br, bl, c (top left, top right, bottom right, bottom left, center)
		effects: {
			fadeInScale: "fade-in-scale",
			slideInBottom: "slide-in-bottom",
			flip3D: "flip-3d",
			letMeIn: "let-me-in",
			slipFromTop: "slip-from-top",
			slit3D: "slit-3d",
			sign3D: "sign-3d",
			default: "slip-from-top"
		}
	},
	vroot: "",
	overlaySelector: ".lw-alert-overlay",
	_pageInit: [],
	_pageLoad: [],
	_delayedFunctions: [],
	_delayedFunctionsCall: 100,
	siteName: "",
	popups: [],
	utils: this.lw ? this.lw.utils : null,
	removeOverlay: null,
	overlays: 0,
	AppendInit: function (obj) {
		lw._pageInit.push(obj);
	},
	AppendLoad: function (obj) {
		lw._pageLoad.push(obj);
	},
	Delay: function (obj) {
		var delay = arguments[1] || lw._delayedFunctionsCall;
		lw._delayedFunctions.push({ fun: obj, delay: delay });
	},
	load: function () {
		for (var i = 0; i < lw._pageLoad.length; i++)
			if ("function" === typeof lw._pageLoad[i])
				lw._pageLoad[i]();


		for (var i = 0; i < lw._delayedFunctions.length; i++) {
			if ("function" === typeof lw._delayedFunctions[i].fun) {
				setTimeout(lw._delayedFunctions[i].fun, lw._delayedFunctions[i].delay);
			}
		}
	},
	init: function (vroot, $, siteName, Editable) {
		$(window).bind("load", lw.load);

		lw.vroot = vroot;
		lw.siteName = siteName.replace("&reg;", "®").replace("®", "<sup>®</sup>");
		lw.Editable = Editable;
		lw._init($);
		try {
			lw._initSiteSearch();
		} catch (e) { }

		lw.lazyLoadImages();

		lw.isMobile = (/android|webos|iphone|ipad|ipod|blackberry/i.test(navigator.userAgent.toLowerCase()));

		function includeJS(jsFile) {
			$('head').append($('<script>').attr('type', 'text/javascript').attr('src', jsFile));
		}
		if ($(".math-tex").length > 0)
			includeJS("//cdn.mathjax.org/mathjax/latest/MathJax.js?config=TeX-AMS-MML_HTMLorMML");
	},
	_init: function () {
		if ($.browser.webkit) {
			lw.webkit = true;
			$("html").addClass("webkit");
		}
		if ($.browser.msie) {
			lw.msie = true;
			$("html").addClass("msie");
		}
		if ($.browser.mozilla) {
			lw.mozilla = true;
			$("html").addClass("mozilla");
		}

		for (var i = 0; i < lw._pageInit.length; i++)
			if ("function" === typeof lw._pageInit[i])
				lw._pageInit[i]();

		$("li:first-child").addClass("first");
		$("li:last-child").addClass("last");

		if (lw.__pageInit && typeof lw.__pageInit == "function") {
			lw.__pageInit();
			delete lw.__pageInit;
		}
	},
	SideLoad: function (func) {
		if (typeof func === "function")
			setTimeout(func, 100);
		if (lw.__pageInit && typeof lw.__pageInit == "function") {
			setTimeout(lw.__pageInit, 100);
			delete lw.__pageInit;
		}
	},
	showTooltip: function (el, color, message, autohide, position, createHidden) {
		position = position ? position : "tr";
		message = message.replace("\r\n", "<Br />");
		var tooltip;
		var animateTo = {};
		var pos = el.offset();

		if (!el.data("tooltip")) {

			var div = "<div class=\"lw-tooltip lw-tooltip-{0}\"><div class=txt>{1}</div><div class=specular><div></div></div><div class=arrow></div>";

			div = div.Format(color, message);



			tooltip = $(div);
			$(document.body).append(tooltip);
		} else {
			tooltip = el.data("tooltip");
			$(".txt", tooltip).html(message);
		}
		switch (position) {
			case "tr": //top right
				animateTo = { top: pos.top - tooltip.outerHeight() - 5 };
				break;
			default:
				break;
		}

		animateTo.opacity = 1;

		tooltip.css({ top: animateTo.top - 5, opacity: 0, left: pos.left, width: el.outerWidth(), display: "block" });

		tooltip.el = el;

		el.data("tooltip", tooltip);

		if (!createHidden) {
			tooltip.stop().animate(animateTo, 300);
		}
		if (el.data("tooltiphide"))
			clearTimeout(el.data("tooltiphide"));

		if (autohide && autohide > 0) {
			el.data("tooltiphide", setTimeout(function () {
				tooltip.stop().animate({ top: animateTo.top - 10, opacity: 0 }, { duration: 200, complete: function () { tooltip.css("display", "none"); } });
			}, autohide)
			);
		}

		el.bind("mouseover", function () {
			var pos = $(this).offset();
			switch (position) {
				case "tr": //top right
					animateTo = { top: pos.top - tooltip.outerHeight() - 5 };
					break;
				default:
					break;
			}
			if (el.data("tooltip")) {
				if (tooltip.css("display") === "none" || !tooltip.data("inited")) {
					tooltip.css({ top: animateTo.top - 5, opacity: 0, left: pos.left, width: el.width(), display: "block" });
					tooltip.data("inited", true);
				}

				tooltip.stop().animate({ opacity: 1, top: animateTo.top }, { duration: 500 });

				if (el.data("tooltiphide"))
					clearTimeout(el.data("tooltiphide"));
			}
		});

		el.bind("mouseout", function () {
			el.data("tooltiphide", setTimeout(function () {
				tooltip.stop().animate({ top: animateTo.top - 10, opacity: 0 }, {
					duration: 500, complete: function () {
						tooltip.css("display", "none");
					}
				});
			}, 1000)
			);
		});
	},
	deleteTooltip: function (el) {
		if (el.data("tooltip")) {
			el.data("tooltip").remove();
			el.data("tooltip", null);
		}
	},
	closeOverlay: function (area) {
		var body = $(document.body);

		area = area ? area : body;
		area = area.length > 0 ? area : body;

		var overlay = area.find(lw.overlaySelector);
		if (!overlay || overlay.length == 0)
			return;

		overlay.removeClass("overlay-visible");

		lw.overlays--;

		lw.removeOverlay = setTimeout(function () {
			if (lw.overlays <= 0)
				overlay.remove();
		}, 10);
	},
	showOverlay: function (area, callBack, color, action) {
		var body = $(document.body);

		area = area ? area : body;
		area = area.length > 0 ? area : body;

		var overlay = area.find(lw.overlaySelector);

		if (!overlay || overlay.length == 0) {
			overlay = $("<div class=lw-alert-overlay />");
			overlay.appendTo(area);
		}

		overlay = area.find(lw.overlaySelector);

		if (lw.isMobile) {
			lw.viewPort = { width: $(window).width(), height: $(window).height(), fullWidth: $(document).width(), fullHeight: $(document).height() };
			overlay.css({
				"position": "absolute",
				width: lw.viewPort.fullWidth,
				height: lw.viewPort.fullHeight
			});
		}

		if (action && "function" == typeof action)
			overlay.click(action);

		setTimeout(function () {
			overlay.addClass("overlay-visible");
		}, 10);
		if (callBack)
			setTimeout(callBack, 500);

		lw.overlays++;
	},
	prompt: function (fields, action, callback, cssClass, cmsMode, title) {
		clearTimeout(lw.removeOverlay);
		var title = title ? title : lw.siteName;
		var bodyFields = [];
		if (typeof fields === "string") {
			fields = [{ title: fields, name: "confirmText" }];
		}

		$.each(fields, function () {
			this.mandatory = !isOk(this.mandatory) ? "true" : this.mandatory;
			switch (this.type) {
				case "select":
					var sel = $("<select id=\"{0}\" name=\"{0}\"  class=\"form-control\" data-mandatory=\"{1}\"/>".Format(this.name, this.mandatory));
					if (this.src) {
						var src = $(this.src)[0];
						var selectedValue = null;
						for (var i = 0; i < src.options.length; i++) {
							sel[0].options.length++;
							var option = sel[0].options[sel[0].options.length - 1];
							option.text = src.options[i].text;
							option.value = src.options[i].value;

							if (this.value && (this.value == option.value || this.value == option.text)) {
								selectedValue = option.value;
								option["selected"] = "selected";
							}
						}
						if (isOk(selectedValue)) {
							sel.attr("data-selected", selectedValue);
						}
					}
					bodyFields.push("<div class=row><label for=\"{1}\" class=row>{0}</label>{2}</div>".Format(this.title, this.name, sel[0].outerHTML));
					break;
				case "file":
					bodyFields.push("<div class=row><label for=\"{1}\">{0}</label><input id=\"{1}\" name=\"{1}\" type=\"{2}\" {3} class=\"form-control\" data-mandatory=\"{4}\"/></div>".Format(this.title, this.name, this.type, this.multiple ? " multiple" : "", this.mandatory));
					break;
				case "textarea":
					bodyFields.push("<div class=row><label for=\"{1}\">{0}</label><textarea id=\"{1}\" name=\"{1}\" class=\"form-control autosize\" data-mandatory=\"{2}\">{3}</textarea></div>".Format(this.title, this.name, this.mandatory, this.value ? this.value : ""));
					break;
				case "div":
					bodyFields.push("<div class='row prompt-description'>{0}</div>".Format(this.title));
					break;
				default:
					bodyFields.push("<div class=row><label for=\"{1}\">{0}</label><input id=\"{1}\" name=\"{1}\" type=\"{2}\" {3} {5} class=\"form-control\" data-mandatory=\"{4}\" /></div>".Format(this.title, this.name, this.type, this.maxlength ? "maxlength=" + this.maxlength : "", this.mandatory, this.value ? "value='" + this.value + "'" : ""));
					break;
			}
		});
		var message = bodyFields.join("");

		var bodyText = $("<h5>{0}<a class=close></a></h5><form><div class=\"b\">{1}</div></form>".Format(title, message));
		var windowElement = $("<div class=\"lw-alert lw-confirm form\"/>");
		if (cssClass)
			windowElement.addClass(cssClass);

		/// if cmsMode and select input make it combobox
		//if (cmsMode)
		//bodyText.children("div.b").children("select").combobox();

		var buttons = [
			 {
			 	text: "Submit",
			 	className: "ok",
			 	action: function (e) {

			 		var ret = {};

			 		for (var i = 0; i < fields.length; i++) {
			 			var name = fields[i].name;
			 			var field = windowElement.find("#" + name);
			 			ret[name] = field.val();
			 			if (!isOk(ret[name]) && field.data("mandatory") == true) {
			 				field.addClass("lw-not-validated");
			 				field[0].focus();
			 				return false;
			 			}
			 		}

			 		if (typeof action === "function") {
			 			action(ret);
			 			windowElement.trigger("close");
			 		}
			 		else {
			 			var form = windowElement.find("form");

			 			if (window.FormData) {
			 				var fd = new FormData(form[0]);
			 				var xhr = new XMLHttpRequest();

			 				windowElement.data("xhr", xhr);


			 				var progress = form.find(".upload-progress").length > 0 ?
								form.find(".upload-progress") :
								$("<div class=\"upload-progress\">\
									<span class=\"bar\"></span>	<span class=\"percentage\">Uploading: 0%</span></div>");

			 				form.find(".b").append(progress);

			 				xhr.upload.addEventListener("progress", function (e) {
			 					var percentComplete = Math.round(e.loaded * 100 / e.total);
			 					form.find(".bar").width(Math.round(form.find(".upload-progress").width() * percentComplete / 100));
			 					form.find(".percentage").html("Uploading: {0}%".Format(percentComplete));
			 				}, false);
			 				xhr.upload.addEventListener("error", function (e) {
			 					lw.alert("An error occured: " + e.description);
			 				});
			 				xhr.onload = function (e) {
			 					form.find(".percentage").html("Upload Complete!");

			 					if (xhr.status == 200) {
			 						if (typeof callback === "function")
			 							callback(jQuery.parseJSON(xhr.responseText), e);
			 					}
			 					else {
			 						lw.alert(xhr.responseText, "", "", "validation-error");
			 					}
			 					windowElement.trigger("close");

			 				};
			 				xhr.open("POST", action);
			 				xhr.send(fd);
			 				progress.show("fast");
			 			}
			 			else {

			 				lw.loader(form, "Please wait...");
			 				form.ajaxSubmit({
			 					url: action,
			 					data: { ajax: true },
			 					dataType: "json",
			 					cache: false,
			 					success: function (e) {
			 						if (typeof callback === "function")
			 							callback(e);
			 					},
			 					error: function (e) {
			 						if (e.status == 0)
			 							return;

			 						alert("An error occured");
			 					},
			 					complete: function () {
			 						lw.hideLoader(form);
			 						windowElement.trigger("close");
			 					}
			 				});
			 			}
			 		}

			 	}
			 }, {
			 	text: "Cancel",
			 	className: "cancel",
			 	action: function () {

			 		var xhr = windowElement.data("xhr");
			 		if (isOk(xhr)) {
			 			xhr.abort();
			 			return false;
			 		}

			 		windowElement.trigger("close");
			 	}
			 }
		];

		windowElement.append(bodyText);

		if (buttons && buttons.length > 0) {
			var footer = $("<div class=f />");

			$(buttons).each(function () {
				var button = $("<button type=\"button\" class=\"btn\"><span>{0}</span></button>".Format(this.text));

				if (this.action)
					button.bind("click", this.action);

				if (this.className)
					button.addClass(this.className);

				footer.append(button);
			});

			windowElement.append(footer);
		}


		windowElement.keypress(function (e) {
			if (e.keyCode == 13) {
				buttons[0].action();
				return false;
			}
		});

		windowElement.data("remove", true);
		lw.popup(windowElement);

		return windowElement;
	},
	yesNo: function (message, yesCallback, noCallback, yesText, noText, cssClass, title, effect) {
		return lw.alert(message, title, [{
			text: yesText || "Yes",
			className: "ok close",
			action: yesCallback
		}, {
			text: noText || "No",
			className: "cancel close",
			action: noCallback
		}], cssClass, noCallback, effect);
	},
	alert: function (message, title, buttons, cssClass, callBack, effect) {
		title = title ? title : lw.siteName;
		if (!isOk(buttons))
			buttons = "OK";

		var bodyText = $("<h5>{0}<a class=close></a></h5><div class=b>{1}</div>".Format(title, message));
		var windowElement = $("<div class=lw-alert />");
		if (cssClass)
			windowElement.addClass(cssClass);

		windowElement.append(bodyText);

		if (buttons && buttons.length > 0) {
			var footer = $("<div class=f />");
			if (typeof buttons === "string") {
				buttons = { text: buttons, className: "ok close" };
			}
			$(buttons).each(function () {
				var button = $("<button type=\"button\" class=\"btn\"><span>{0}</span></button>".Format(this.text));

				if (this.action)
					button.bind("click submit", this.action);

				if (this.className)
					button.addClass(this.className);

				footer.append(button);
			});
			windowElement.append(footer);
		}
		windowElement.data("remove", true);
		lw.popup(windowElement, callBack, effect);
		return windowElement;
	},
	popupCheckKeyStroke: function (e) {

		if (e === true || e.keyCode === 27) {
			if (lw.stopNextPopupClose)
				return;
			lw.closePopup();
			lw.stopNextPopupClose = true;
			setTimeout(function () { lw.stopNextPopupClose = null; }, 10);
		}
	},
	closePopup: function (windowElement) {

		windowElement = lw.popups.pop();
		if (!isOk(windowElement))
			return;

		windowElement.trigger("beforeclose");
		windowElement.removeClass("lw-visible");
		setTimeout(function () {
			windowElement.trigger("close");
			windowElement.css({ "visibility": "hidden", top: -2000 });
			if (windowElement.data("remove") === true)
				windowElement.remove();
		}, lw.popupCte.speed);

		lw.escape(lw.popupCheckKeyStroke);

		lw.closeOverlay();

		return false;
	},
	popup: function (windowElement, callBack, effect, cssClass) {

		windowElement = typeof windowElement == typeof "ballout" ? $(windowElement) : windowElement;

		windowElement.find(".close").click(lw.closePopup);

		windowElement.on("close", lw.closePopup);

		$(document).bind("keyup keydown", lw.popupCheckKeyStroke);

		effect = effect ? effect : lw.popupCte.effects.default;

		$(document.body).append(windowElement);
		windowElement.removeClass("lw-alert");

		var remove = windowElement.data("remove");

		if (windowElement.hasClass("lw-autocreated")) {
			$.each(lw.popupCte.effects, function () {
				windowElement.removeClass(this);
			});
			windowElement.addClass(effect);
		}
		else
			windowElement = windowElement.wrap("<div class=\"lw-autocreated lw-alert " + effect + "\"/>").parent();

		if (cssClass)
			windowElement.addClass(cssClass);

		windowElement.data("remove", remove);

		var firstInputId = windowElement.find("input").first().attr("id");

		function showWindow() {

			windowElement.css({
				display: "block"
			});

			//document.documentElement.className = "lw-perspective";

			var sels = windowElement.find("select");
			sels.each(function () {
				var $sel = $(this);
				$sel.find("option[value=" + $sel.data("selected") + "]").prop("selected", true);
			});

			setTimeout(function () {
				windowElement.addClass("lw-visible");
			}, 10);

			var firstInput = windowElement.find("input").first();
			if (firstInput.length == 0) {
				firstInput = windowElement.find("button").first();
			}
			if (firstInput.length > 0) {
				setTimeout(function () {
					$(firstInput).focus();
				}, 200);
			}
		}

		windowElement.bind("close", callBack);

		lw.showOverlay();
		showWindow();

		lw.popups.push(windowElement);

		return windowElement;
	},
	loader: function (el, message, overlayColor, loaderArea) {
		if (!isOk(el)) {
			el = $(document.body);
		}

		loaderArea = loaderArea ? loaderArea : $(isOk(el.attr("LoaderArea")) ? el.attr("LoaderArea") : document.body);

		lw.showOverlay(el);

		var loader = $("<div/>");

		message = (message && message !== "") ? message : "Please wait...";

		if (isOk(message)) {
			loader.append($("<span>" + message + "</span>"));
		}

		var loaderClass = isOk(el.attr("LoaderClass")) ? el.attr("LoaderClass") : "lw-loader";
		loader.addClass(loaderClass);
		loader.css("opacity", 0);

		$(document.body).append(loader);
		el.data("loader", loader);

		setTimeout(function () {
			loader.css({
				"position": "absolute",
				top: loaderArea.position().top + loaderArea.height() / 2 - loader.height() / 2,
				left: loaderArea.position().left + loaderArea.width() / 2 - loader.width() / 2,
				opacity: 0
			});
			loader.animate({ opacity: 1 }, 300);
		}, 10);
	},
	hideLoader: function (el) {
		if (!el)
			el = $(document.body);

		var loader = el.data("loader");
		if (isOk(loader)) {
			loader.animate({ opacity: 0 }, {
				duration: 300, complete: function () {
					loader.remove();
					el.data("loader", null);
				}
			});
		}
		lw.closeOverlay(el);
	},
	Flip: function (nextDiv, oldDiv, duration) {

	},
	imagesToLoad: null,
	loadFailureLimit: 2,
	lazyLoadImages: function () {
		//TODO: Load the images when they become visible
		lw.imagesToLoad = $("img.lazy-load");
		if (lw.imagesToLoad.length > 0) {
			var img = $(lw.imagesToLoad[0]);
			img.removeClass("lazy-load");
			img.attr("src", img.attr("data-image"));
			img.load(lw.lazyLoadImages);
			img.error(function () {
				lw.lazyLoadImages();
				if (img.data("load-error"))
					img.data("load-error", img.data("load-error") + 1);
				else
					img.data("load-error", 1);

				if (img.data("load-error") > lw.loadFailureLimit)
					return;

				img.addClass("lazy-load");
			});
		}
	},
	escapes: [],
	fireEscape: function (e) {
		if (e === true || e.keyCode === 27) {
			if (lw.escapes.length > 0)
				lw.escapes.pop()(e);
			if (lw.escapes.length == 0)
				$(document).unbind("keyup keydown", lw.fireEscape);
		}
	},
	escape: function (func) {
		if (func && "function" == typeof func) {
			lw.escapes.push(func);
			$(document).bind("keyup keydown", lw.fireEscape);
		}
		else lw.fireEscape();
	}
};

var liteweb = lw;