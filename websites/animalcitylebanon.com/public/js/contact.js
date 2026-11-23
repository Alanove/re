(function () {
  var form = document.getElementById('ContactUs-Form');
  if (!form) {
    return;
  }

  var statusEl = document.getElementById('ContactUs-Status');
  var submitBtn = form.querySelector('button[type="submit"]');

  function setStatus(message, kind) {
    if (!statusEl) {
      return;
    }
    statusEl.hidden = !message;
    statusEl.textContent = message || '';
    statusEl.classList.remove('is-error', 'is-success');
    if (kind) {
      statusEl.classList.add(kind === 'error' ? 'is-error' : 'is-success');
    }
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    setStatus('', '');

    if (submitBtn) {
      submitBtn.disabled = true;
    }

    var body = new URLSearchParams(new FormData(form));

    fetch(form.getAttribute('action') || '/contact', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: body.toString(),
      credentials: 'same-origin'
    })
      .then(function (response) {
        return response.json().then(function (data) {
          return { ok: response.ok, status: response.status, data: data };
        });
      })
      .then(function (result) {
        if (result.ok && result.data && result.data.success) {
          setStatus(result.data.message || 'Thank you. Your message was sent.', 'success');
          form.reset();
          return;
        }

        var message =
          (result.data && result.data.message) ||
          'Your message could not be sent. Please try again.';
        if (result.data && result.data.fields) {
          var first = Object.keys(result.data.fields)[0];
          if (first && result.data.fields[first]) {
            message = result.data.fields[first];
          }
        }
        setStatus(message, 'error');
      })
      .catch(function () {
        setStatus('Your message could not be sent. Please try again.', 'error');
      })
      .finally(function () {
        if (submitBtn) {
          submitBtn.disabled = false;
        }
      });
  });
})();
