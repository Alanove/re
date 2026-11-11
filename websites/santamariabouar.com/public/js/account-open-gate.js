(function () {
  function initOpenGate() {
    var btn = document.getElementById('openGateBtn');
    var modalEl = document.getElementById('openGateModal');
    if (!btn || !modalEl || !window.bootstrap) return;

    var titleEl = document.getElementById('openGateModalLabel');
    var bodyEl = document.getElementById('openGateModalBody');
    var closeBtn = document.getElementById('openGateModalClose');
    var labelEl = btn.querySelector('.account-btn__label');
    var spinnerEl = btn.querySelector('.account-btn__spinner');
    var modal = new bootstrap.Modal(modalEl);
    var inFlight = false;

    function setButtonLoading(isLoading) {
      btn.disabled = isLoading;
      btn.classList.toggle('is-loading', isLoading);
      if (labelEl) labelEl.hidden = isLoading;
      if (spinnerEl) spinnerEl.hidden = !isLoading;
    }

    function showStatus(title, message, isError) {
      if (titleEl) titleEl.textContent = title;
      if (bodyEl) {
        bodyEl.textContent = message;
        bodyEl.className = 'modal-body' + (isError ? ' text-danger' : '');
      }
      if (closeBtn) closeBtn.disabled = false;
      modal.show();
    }

    function showWorking() {
      if (titleEl) titleEl.textContent = 'Opening main gate';
      if (bodyEl) {
        bodyEl.className = 'modal-body';
        bodyEl.textContent = 'Sending the open command. Please wait…';
      }
      if (closeBtn) closeBtn.disabled = true;
      modal.show();
    }

    btn.addEventListener('click', function () {
      if (inFlight) return;
      inFlight = true;
      setButtonLoading(true);
      showWorking();

      fetch(btn.getAttribute('data-open-url') || '/account/open-gate', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'X-CSRF-Token': btn.getAttribute('data-csrf') || ''
        },
        body: '{}'
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
          var message = result.data.message || (result.ok ? 'The main gate is opening.' : 'Could not open the gate.');
          if (result.ok && result.data.success) {
            showStatus('Gate opening', message, false);
          } else {
            showStatus('Could not open gate', message, true);
          }
        })
        .catch(function () {
          showStatus('Could not open gate', 'The request failed. Please try again.', true);
        })
        .finally(function () {
          inFlight = false;
          setButtonLoading(false);
        });
    });

    modalEl.addEventListener('hidden.bs.modal', function () {
      if (titleEl) titleEl.textContent = 'Opening main gate';
      if (bodyEl) {
        bodyEl.className = 'modal-body';
        bodyEl.textContent = '';
      }
      if (closeBtn) closeBtn.disabled = false;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initOpenGate);
  } else {
    initOpenGate();
  }
})();
