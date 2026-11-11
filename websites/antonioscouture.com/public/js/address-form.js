/**
 * Shared address form logic: city autocomplete (API with nameStartsWith) and state (US only).
 * Use: AddressForm.init({ ids: { ... }, onChange: function() {} })
 * Returns: { loadStates, hideCitySuggestions, clearCity }
 */
(function () {
    'use strict';

    var DEBOUNCE_MS = 250;
    var SUGGESTIONS_BLUR_MS = 150;

    function getEl(id) {
        return id ? document.getElementById(id) : null;
    }

    function loadStates(ids) {
        var country = getEl(ids.country);
        var stateWrap = getEl(ids.stateWrap);
        var stateSelect = getEl(ids.stateSelect);
        var stateInput = getEl(ids.stateInput);
        var stateHidden = getEl(ids.stateHidden);
        if (!country || !stateSelect || !stateInput) return;
        var code = (country.value || '').trim().toUpperCase();
        if (code === 'US' || code === 'USA') {
            if (stateWrap) stateWrap.classList.remove('d-none');
            stateInput.classList.add('d-none');
            stateSelect.classList.remove('d-none');
            stateSelect.innerHTML = '<option value="">Loading...</option>';
            fetch('/api/shipping/states?country=US').then(function (r) { return r.json(); }).then(function (data) {
                stateSelect.innerHTML = '<option value="">Select state</option>';
                if (data.states && data.states.length) {
                    data.states.forEach(function (s) {
                        var name = s.name || s;
                        var sc = s.code != null ? s.code : name;
                        var opt = document.createElement('option');
                        opt.value = sc;
                        opt.textContent = name;
                        stateSelect.appendChild(opt);
                    });
                }
                var current = (stateHidden && stateHidden.value) ? stateHidden.value.trim() : '';
                if (current) stateSelect.value = current;
            }).catch(function () { stateSelect.innerHTML = '<option value="">Error</option>'; });
        } else {
            if (stateWrap) stateWrap.classList.add('d-none');
            stateSelect.classList.add('d-none');
            stateInput.classList.remove('d-none');
            if (stateHidden) stateHidden.value = stateInput.value;
        }
    }

    function init(options) {
        var ids = options.ids || {};
        var onChange = typeof options.onChange === 'function' ? options.onChange : function () {};
        var onCountryChange = typeof options.onCountryChange === 'function' ? options.onCountryChange : function () {};

        var countryId = ids.country;
        var stateWrapId = ids.stateWrap;
        var stateSelectId = ids.stateSelect;
        var stateInputId = ids.stateInput;
        var stateHiddenId = ids.stateHidden;
        var cityInputId = ids.cityInput;
        var cityHiddenId = ids.cityHidden;
        var citySuggestionsId = ids.citySuggestions;

        var debounceTimer = null;

        function hideCitySuggestions() {
            var ul = getEl(citySuggestionsId);
            if (ul) ul.style.display = 'none';
        }

        function showCitySuggestions(items) {
            var ul = getEl(citySuggestionsId);
            if (!ul) return;
            ul.innerHTML = '';
            if (!items || items.length === 0) {
                ul.style.display = 'none';
                return;
            }
            items.forEach(function (c) {
                var name = (c && c.name) ? c.name : String(c);
                var li = document.createElement('li');
                li.className = 'list-group-item list-group-item-action';
                li.textContent = name;
                li.style.cursor = 'pointer';
                li.addEventListener('click', function () {
                    var cityInput = getEl(cityInputId);
                    var cityHidden = getEl(cityHiddenId);
                    if (cityInput) cityInput.value = name;
                    if (cityHidden) cityHidden.value = name;
                    hideCitySuggestions();
                    onChange();
                });
                ul.appendChild(li);
            });
            ul.style.display = 'block';
        }

        function fetchCitySuggestions(nameStartsWith) {
            var country = getEl(countryId);
            var stateSelect = getEl(stateSelectId);
            var stateInput = getEl(stateInputId);
            if (!country) return;
            var countryCode = (country.value || '').trim();
            if (!countryCode) return;
            var stateVal = (countryCode === 'US' || countryCode === 'USA') && stateSelect && !stateSelect.classList.contains('d-none')
                ? (stateSelect.value || '').trim()
                : (stateInput ? stateInput.value : '').trim();
            var url = '/api/shipping/cities?country=' + encodeURIComponent(countryCode) +
                (stateVal ? '&state=' + encodeURIComponent(stateVal) : '') +
                '&nameStartsWith=' + encodeURIComponent(nameStartsWith);
            fetch(url).then(function (r) { return r.json(); })
                .then(function (data) {
                    if (data.cities) showCitySuggestions(data.cities);
                    else hideCitySuggestions();
                })
                .catch(function () { hideCitySuggestions(); });
        }

        function onCityInput() {
            var input = getEl(cityInputId);
            var hidden = getEl(cityHiddenId);
            if (!input || !hidden) return;
            var val = (input.value || '').trim();
            hidden.value = val;
            clearTimeout(debounceTimer);
            if (val.length === 0) {
                hideCitySuggestions();
                onChange();
                return;
            }
            debounceTimer = setTimeout(function () { fetchCitySuggestions(val); }, DEBOUNCE_MS);
            onChange();
        }

        function syncStateToHidden() {
            var stateSelect = getEl(stateSelectId);
            var stateInput = getEl(stateInputId);
            var stateHidden = getEl(stateHiddenId);
            if (!stateHidden) return;
            if (stateSelect && !stateSelect.classList.contains('d-none')) stateHidden.value = stateSelect.value || '';
            else if (stateInput) stateHidden.value = stateInput.value || '';
            onChange();
        }

        function clearCity() {
            var cityInput = getEl(cityInputId);
            var cityHidden = getEl(cityHiddenId);
            if (cityInput) cityInput.value = '';
            if (cityHidden) cityHidden.value = '';
            hideCitySuggestions();
        }

        // Event listeners
        var countryEl = getEl(countryId);
        if (countryEl) {
            countryEl.addEventListener('change', function () {
                loadStates(ids);
                clearCity();
                onCountryChange();
            });
        }

        var cityInputEl = getEl(cityInputId);
        if (cityInputEl) {
            cityInputEl.addEventListener('input', onCityInput);
            cityInputEl.addEventListener('focus', function () {
                var val = (this.value || '').trim();
                if (val.length > 0) fetchCitySuggestions(val);
            });
            cityInputEl.addEventListener('blur', function () {
                setTimeout(hideCitySuggestions, SUGGESTIONS_BLUR_MS);
            });
        }

        var stateSelectEl = getEl(stateSelectId);
        if (stateSelectEl) {
            stateSelectEl.addEventListener('change', function () {
                syncStateToHidden();
                hideCitySuggestions();
            });
        }

        var stateInputEl = getEl(stateInputId);
        if (stateInputEl) {
            stateInputEl.addEventListener('input', syncStateToHidden);
        }

        // Sync hidden city from visible input (e.g. pre-filled address)
        if (cityInputEl && getEl(cityHiddenId)) {
            var v = (cityInputEl.value || '').trim();
            if (v) getEl(cityHiddenId).value = v;
        }

        loadStates(ids);

        return {
            loadStates: function () { loadStates(ids); },
            hideCitySuggestions: hideCitySuggestions,
            clearCity: clearCity
        };
    }

    window.AddressForm = { init: init };
})();
