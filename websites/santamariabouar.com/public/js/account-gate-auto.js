(function () {
  function initGateAuto() {
    var root = document.getElementById('gateAutoRoot');
    if (!root) return;

    var statusEl = document.getElementById('gateAutoStatus');
    var againBtn = document.getElementById('gateAutoAgain');
    var inFlight = false;

    function setStatus(message, isError) {
      if (!statusEl) return;
      statusEl.textContent = message;
      statusEl.classList.toggle('is-error', !!isError);
      statusEl.classList.toggle('is-success', !isError && message.indexOf('opening') === -1);
    }

    function openGate() {
      if (inFlight) return;
      inFlight = true;
      if (againBtn) againBtn.hidden = true;
      setStatus('Opening the main gate…', false);

      fetch(root.getAttribute('data-open-url') || '/account/open-gate', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': root.getAttribute('data-csrf') || ''
        },
        body: '{}',
        credentials: 'same-origin'
      })
        .then(function (res) {
          return res.text().then(function (text) {
            var data = {};
            try {
              data = text ? JSON.parse(text) : {};
            } catch (err) {
              data = {};
            }
            return { ok: res.ok, status: res.status, data: data };
          });
        })
        .then(function (result) {
          var message =
            result.data.message ||
            (result.ok ? 'The main gate is opening.' : 'Could not open the gate.');
          if (result.ok && result.data.success) {
            setStatus(message, false);
            if (statusEl) statusEl.classList.add('is-success');
          } else if (result.status === 401) {
            window.location.href =
              '/account/login?redirect=' + encodeURIComponent('/account/gate');
            return;
          } else {
            setStatus(message, true);
          }
          if (againBtn) againBtn.hidden = false;
        })
        .catch(function () {
          setStatus('The request failed. Please try again.', true);
          if (againBtn) againBtn.hidden = false;
        })
        .finally(function () {
          inFlight = false;
        });
    }

    if (againBtn) {
      againBtn.addEventListener('click', function () {
        openGate();
      });
    }

    openGate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGateAuto);
  } else {
    initGateAuto();
  }
})();
